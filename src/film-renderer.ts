import {centerStyleCamera,projectionCamera} from './style-camera';
import {createBitmapGrid,gridStep,gridPixelsPerUnit} from './bitmap-grid';
import {qualityPlan,standardQuality,type RenderQualityProfile} from './render-quality';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import {cubeGeometry} from './cube-geometry';
import { activeShot, type Project, type SceneData, type MaterialLook } from './editor-model';
import { fitDistance, sampleCamera,shotPose, type CameraPose,type CameraDraft } from './camera-motion';
import { drawTitle, type Anchor } from './title-renderer';
import {modelState,parcelPose,displayParcelPose,sampleFade} from './model-motion';
import {PhysicsCache,sampleDrop} from './physics-cache';
const signalShader={
  uniforms:{tDiffuse:{value:null},time:{value:0},strength:{value:1},resolution:{value:new THREE.Vector2()},paper:{value:0},tDepth:{value:null},orthographic:{value:0},fogEnabled:{value:0},fogNear:{value:0},fogFar:{value:1},cameraNear:{value:.01},cameraFar:{value:10000},background:{value:new THREE.Vector3()}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`#include <packing>
  uniform float orthographic;uniform sampler2D tDepth;uniform float fogEnabled;uniform float fogNear;uniform float fogFar;uniform float cameraNear;uniform float cameraFar;uniform vec3 background;
  uniform sampler2D tDiffuse;uniform float time;uniform float strength;uniform vec2 resolution;uniform float paper;varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){vec4 pixel=texture2D(tDiffuse,vUv);vec3 c=pixel.rgb;float grain=hash(vUv*resolution+floor(time*30.0));
  c*=1.0-strength*(.02+.02*sin(vUv.y*resolution.y*3.14159));c+=strength*(grain-.5)*.01;
  float v=1.0-smoothstep(.2,.8,length(vUv-.5));c*=mix(.78+.22*v,1.0,paper);if(fogEnabled>.5){float depth=unpackRGBAToDepth(texture2D(tDepth,vUv));float distance=orthographic>.5?-orthographicDepthToViewZ(depth,cameraNear,cameraFar):-perspectiveDepthToViewZ(depth,cameraNear,cameraFar);float fogAmount=smoothstep(fogNear,fogFar,distance);c=mix(c,background,fogAmount);pixel.a=mix(pixel.a,1.0,fogAmount);}
  gl_FragColor=vec4(c,pixel.a);}`,
};
export class FilmRenderer{
  private renderLimit=0;
  get maxRenderSize(){if(!this.renderLimit){const gl=this.renderer.getContext();this.renderLimit=Math.min(this.renderer.capabilities.maxTextureSize,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)));}return this.renderLimit;}
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=new THREE.PerspectiveCamera(38,16/9,.01,10000);
  private mesh:THREE.InstancedMesh;
  private ground:THREE.Mesh;
  private grid:THREE.GridHelper;
  private composer:EffectComposer;
  private fx:ShaderPass;
  private fxaa:ShaderPass;
  private bloom:UnrealBloomPass;
  private fogDepth=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  private fogDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  private key:THREE.DirectionalLight;
  private rim:THREE.DirectionalLight;
  private hemi:THREE.HemisphereLight;
  private fill:THREE.DirectionalLight;
  private span:number;
  private currentPose?:CameraPose;
  private physics:PhysicsCache;
  private context:CanvasRenderingContext2D;
  private parcelIndices=new Map<number,number>();
  private anchorPoint=new THREE.Vector3();
  private matrix=new THREE.Matrix4();private position=new THREE.Vector3();private scale=new THREE.Vector3();private rotation=new THREE.Quaternion();private color=new THREE.Color();
  private cubeGeometries={square:cubeGeometry('square'),chamfered:cubeGeometry('chamfered'),'rounded-small':cubeGeometry('rounded-small'),'rounded-large':cubeGeometry('rounded-large')};
  private materials:Record<MaterialLook,THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>;
  private materialTime={value:0};
  private width=0;private height=0;private internalWidth=0;private internalHeight=0;private lost=false;private disposed=false;private look='';
  private lossHandler=(event:Event)=>{event.preventDefault();this.lost=true;this.onError('The 3D context was interrupted. Reload to recreate the preview.');};
  constructor(public canvas:HTMLCanvasElement,public data:SceneData,private onError:(message:string)=>void,onPhysicsReady:()=>void=()=>{}){
    data.layout.parcels.forEach((parcel,index)=>this.parcelIndices.set(parcel.txIndex,index));
    this.physics=new PhysicsCache(data,onPhysicsReady);
    this.context=canvas.getContext('2d',{alpha:false})!;if(!this.context)throw Error('Canvas 2D is unavailable.');
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.addEventListener('webglcontextlost',this.lossHandler);
    this.span=Math.max(data.layout.width,data.layout.height);
    this.materials={solid:new THREE.MeshStandardMaterial({roughness:.44,metalness:.32}),neon:new THREE.MeshStandardMaterial({roughness:.35,metalness:.42}),wireframe:new THREE.MeshBasicMaterial({transparent:true,depthWrite:false}),hologram:new THREE.MeshBasicMaterial({transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide})};
    for(const material of Object.values(this.materials))material.fog=false;
    for(const kind of ['neon','wireframe','hologram'] as const){
      const material=this.materials[kind];material.onBeforeCompile=shader=>{
        shader.uniforms.filmTime=this.materialTime;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFilmLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFilmLocal=position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFilmLocal;uniform float filmTime;');
        // Integrate narrow edges over a screen pixel instead of clipping subpixel fragments.
        const edge=`vec3 b=abs(vFilmLocal);float second=min(min(max(b.x,b.y),max(b.y,b.z)),max(b.x,b.z));float filmPixel=max(fwidth(second),.0001);float filmEdge=smoothstep(.475-filmPixel,.475+filmPixel,second)*min(1.0,.025/filmPixel);`;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${edge}\n`+(kind==='wireframe'?'diffuseColor.a*=filmEdge;':kind==='hologram'?'diffuseColor.a*=.18+.72*filmEdge;float stripeAA=exp2(-2.0*pow(90.0*fwidth(vFilmLocal.y),2.0));diffuseColor.rgb*=.8+.2*stripeAA*sin(vFilmLocal.y*90.0-filmTime*3.0);':''));
        if(kind==='neon')shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*filmEdge*1.55;diffuseColor.rgb*=.22;');
      };material.customProgramCacheKey=()=>`bitmap-${kind}-3`;
    }
    this.mesh=new THREE.InstancedMesh(this.cubeGeometries['rounded-small'],this.materials.solid,data.layout.parcels.length);this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.scene.add(this.mesh);
    // Invisible receiver: the bitmap has no plate, slab, border or opaque floor.
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(this.span*8,this.span*8),new THREE.ShadowMaterial({color:'#000000',opacity:.38,depthWrite:false,fog:false}));
    this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.025;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.grid=createBitmapGrid(data.layout);this.scene.add(this.grid);
    this.hemi=new THREE.HemisphereLight('#dae4ee','#1c1511',.8);this.scene.add(this.hemi);
    this.key=new THREE.DirectionalLight('#fff0d6',3);this.key.position.set(-this.span,this.span*1.9,this.span*.9);this.key.castShadow=true;
    const shadowResolution=Math.min(4096,this.renderer.capabilities.maxTextureSize);this.key.shadow.mapSize.set(shadowResolution,shadowResolution);this.key.shadow.camera.left=-this.span;this.key.shadow.camera.right=this.span;this.key.shadow.camera.top=this.span;this.key.shadow.camera.bottom=-this.span;this.key.shadow.camera.near=.1;this.key.shadow.camera.far=this.span*6;this.key.shadow.normalBias=.025;this.key.shadow.bias=-.00015;this.scene.add(this.key);
    this.rim=new THREE.DirectionalLight('#b7d2ff',2.4);this.rim.position.set(this.span,this.span*.7,-this.span);this.scene.add(this.rim);
    this.fill=new THREE.DirectionalLight('#fff0e0',.3);this.fill.position.set(this.span*.8,this.span,this.span);this.scene.add(this.fill);
    // Canvas antialiasing alone does not apply to the composer's offscreen buffers.
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,this.renderer.capabilities.maxSamples)});
    this.composer=new EffectComposer(this.renderer,target);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.2,.38,.72);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);this.fx=new ShaderPass(signalShader);this.composer.addPass(this.fx);
  }
  private applyLook(p:Project,opacity:number){
    const look=JSON.stringify([p.material,p.background,p.accent,p.shadows,p.grid,p.preset,opacity,p.backgroundColor,p.lightIntensity,p.ambientIntensity,p.rimIntensity,p.shadowOpacity,p.fog,p.fogNear,p.fogFar,p.lightRotation,p.cubeType]);if(look===this.look)return;this.look=look;
    const paper=p.background==='paper',city=p.preset==='data-city',background=p.backgroundColor??(paper?'#f2ede6':p.background==='studio'?'#182331':'#05070b');
    this.renderer.setClearColor(0x000000,0);this.scene.fog=(p.fog??false)?new THREE.Fog(background,(p.fogNear??1)*this.span,Math.max(p.fogFar??6,(p.fogNear??1)+.1)*this.span):null;
    this.mesh.geometry=this.cubeGeometries[p.cubeType??'rounded-small'];this.mesh.material=this.materials[p.material];
    const material=this.materials[p.material];material.opacity=opacity*(p.material==='hologram'?.75:1);const transparent=['wireframe','hologram'].includes(p.material)||opacity<.999;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.depthWrite=!transparent;this.mesh.visible=opacity>.001;
    const lightAngle=(p.lightRotation??0)*Math.PI/180,lightCos=Math.cos(lightAngle),lightSin=Math.sin(lightAngle);this.key.position.set(this.span*(-lightCos+.9*lightSin),this.span*1.9,this.span*(lightSin+.9*lightCos));
    this.key.color.set(paper?'#ffffff':city?'#99f9ef':'#fff0d6');this.key.intensity=p.lightIntensity??(paper?3.4:city?1.5:3.6);
    this.hemi.color.set(paper?'#ffffff':'#b4cad8');this.hemi.groundColor.set(paper?'#ddd4c9':'#17101d');this.hemi.intensity=p.ambientIntensity??(paper?2.1:city?.7:.65);
    this.rim.color.set(city?p.accent:'#b4c7e6');this.rim.intensity=p.rimIntensity??(paper?.7:2.9);this.fill.intensity=paper?1.4:.3;
    this.key.shadow.intensity=p.shadowOpacity??1;
    // Apply opacity once through the light's shadow map, for all receivers.
    (this.ground.material as THREE.ShadowMaterial).opacity=p.shadowOpacity===undefined?(paper?.22:.38):1;
    this.key.castShadow=p.shadows;this.mesh.castShadow=p.shadows;this.mesh.receiveShadow=p.shadows;this.renderer.shadowMap.enabled=p.shadows;
    this.grid.visible=p.grid;
    this.renderer.toneMappingExposure=paper?1:.95;
  }
  render(project:Project,time:number,width=this.canvas.width,height=this.canvas.height,draft?:CameraDraft,overlays=true,quality:RenderQualityProfile=standardQuality,pan?:[number,number,number],centerStyle=false,poseOverride?:import('./camera-settings').CameraSetting):void{
    if(this.disposed||this.lost)throw Error('The WebGL context is unavailable.');
    const plan=qualityPlan(width,height,quality,this.maxRenderSize,this.renderer.capabilities.maxSamples);
    if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.canvas.width=width;this.canvas.height=height;}
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])if(target.samples!==plan.samples){target.dispose();target.samples=plan.samples;}
    if(plan.internalWidth!==this.internalWidth||plan.internalHeight!==this.internalHeight){this.internalWidth=plan.internalWidth;this.internalHeight=plan.internalHeight;this.renderer.setSize(plan.internalWidth,plan.internalHeight,false);this.composer.setSize(plan.internalWidth,plan.internalHeight);}
    this.fxaa.enabled=plan.fxaa;this.fxaa.uniforms.resolution!.value.set(1/plan.internalWidth,1/plan.internalHeight);
    // Screen-space styling uses output pixels, regardless of supersampling.
    this.fx.uniforms.resolution!.value.set(width,height);
    const shadow=this.key.shadow;
    if(shadow.mapSize.x!==plan.shadowResolution){shadow.dispose();shadow.map=null;shadow.mapPass=null;shadow.mapSize.set(plan.shadowResolution,plan.shadowResolution);shadow.needsUpdate=true;}
    Object.assign(this.canvas.dataset,{internalWidth:String(plan.internalWidth),internalHeight:String(plan.internalHeight),qualityScale:String(plan.scale),qualityRequestedScale:String(plan.requestedScale),qualitySamples:String(plan.samples),qualityFxaa:String(plan.fxaa),qualityShadow:String(plan.shadowResolution)});
    const model=modelState(project,time),look={...project,material:model.material,accent:model.accent};this.applyLook(look,model.opacity);let pose=sampleCamera(this.data,project,time,width/height);
    if(draft){const shot=project.shots.find(s=>s.id===draft.shotId);if(shot)pose=shotPose(this.data,{...shot,camera:{...shot.camera,yawStart:draft.yaw,yawEnd:draft.yaw,elevation:draft.elevation,elevationEnd:draft.elevation,distanceStart:draft.distance,distanceEnd:draft.distance,fov:draft.fov}},shot.start,width/height);}if(poseOverride)pose={...pose,position:new THREE.Vector3(...poseOverride.position),target:new THREE.Vector3(...poseOverride.target),fov:poseOverride.fov};if(centerStyle)centerStyleCamera(this.data,pose,width/height,project.cameraType);if(pan){const offset=new THREE.Vector3(...pan);pose.position.add(offset);pose.target.add(offset);}this.currentPose=pose;
    const orthographic=project.cameraType==='isometric';
    if(orthographic!==(this.camera instanceof THREE.OrthographicCamera)){
      this.camera=projectionCamera(pose,width/height,project.cameraType);
      (this.composer.passes[0] as RenderPass).camera=this.camera;
    }
    if(this.camera instanceof THREE.PerspectiveCamera){this.camera.fov=pose.fov;this.camera.aspect=width/height;}
    else {const half=pose.position.distanceTo(pose.target)*Math.tan(pose.fov*Math.PI/360);this.camera.left=-half*width/height;this.camera.right=half*width/height;this.camera.top=half;this.camera.bottom=-half;}
    this.camera.position.copy(pose.position);this.camera.lookAt(pose.target);
    // Camera editing keeps the subject ahead of the fog as the user zooms out.
    if(this.scene.fog instanceof THREE.Fog){
      const fog=this.scene.fog,baseNear=(look.fogNear??1)*this.span,baseFar=Math.max(look.fogFar??6,(look.fogNear??1)+.1)*this.span;
      const shift=poseOverride?Math.max(0,pose.position.distanceTo(pose.target)+this.span*.5-baseNear):0;
      fog.near=baseNear+shift;fog.far=baseFar+shift;
    }
    const distance=fitDistance(this.data,pose.fov,width/height);this.camera.near=Math.max(.005,distance/5000);this.camera.far=distance*20;this.camera.clearViewOffset();this.camera.updateProjectionMatrix();
    if(project.grid){
      const step=gridStep(gridPixelsPerUnit(this.camera,pose.target,width,height),this.grid.userData.step),paper=project.background==='paper';
      if(step!==this.grid.userData.step||paper!==this.grid.userData.paper){
        this.scene.remove(this.grid);this.grid.dispose();this.grid=createBitmapGrid(this.data.layout,step,paper);this.scene.add(this.grid);
      }
      this.canvas.dataset.gridStep=String(step);
    }
    const bake=model.transform?.kind==='drop'?this.physics.get(model.transform):undefined;
    const base=new THREE.Color(model.accent),selected=base.clone().lerp(new THREE.Color('#ffffff'),.35*model.contextAmount);
    this.data.layout.parcels.forEach((parcel,i)=>{
      const side=parcel.size-.5,p=parcelPose(this.data,parcel,i,bake?undefined:model.transform,time),chosen=parcel.txIndex===model.context?.txIndex,shrink=chosen?1:1-model.isolate;
      if(project.displayMotion)displayParcelPose(p,project.displayMotion,time,this.span);
      this.position.set(p.x,p.y+(chosen?model.targetLift:0),p.z);this.rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw);
      const visible=bake&&model.transform?sampleDrop(bake,i,time-model.transform.start,this.position,this.rotation):true;
      const size=visible?side*shrink*(1+model.pulse):0;this.scale.set(size*p.scale,size*p.heightScale,size*p.scale);this.matrix.compose(this.position,this.rotation,this.scale);this.mesh.setMatrixAt(i,this.matrix);
      this.color.copy(chosen?selected:base);if(!chosen)this.color.multiplyScalar((.75+Math.min(parcel.size/8,.4))*(1-model.dim*.86));this.mesh.setColorAt(i,this.color);
    });
    this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    this.ground.visible=project.shadows&&model.isolate<.98;(this.ground.material as THREE.ShadowMaterial).opacity=(project.shadowOpacity===undefined?(project.background==='paper'?.22:.38):1)*(1-model.isolate)*model.opacity;this.materialTime.value=time;
    this.bloom.enabled=project.bloom>.001;this.bloom.strength=project.bloom;this.fx.uniforms.time!.value=time;this.fx.uniforms.strength!.value=project.scanlines?1:0;this.fx.uniforms.paper!.value=project.background==='paper'?1:0;
    this.renderFogDepth(plan.internalWidth,plan.internalHeight);
    this.composer.render(0);
    // Compose the selected sRGB background after tone mapping and glow.
    this.context.fillStyle=project.backgroundColor??(project.background==='paper'?'#f2ede6':project.background==='studio'?'#182331':'#05070b');
    this.context.imageSmoothingEnabled=true;this.context.imageSmoothingQuality='high';
    this.context.fillRect(0,0,width,height);this.context.drawImage(this.renderer.domElement,0,0,width,height);
    if(overlays)for(const title of [...project.titles].sort((a,b)=>a.start-b.start))drawTitle(this.context,title,project,this.data,time,{width,height,anchor:tx=>this.anchor(tx)});
    const fade=sampleFade(project,time);if(fade.opacity>0){this.context.save();this.context.globalAlpha=fade.opacity;this.context.fillStyle=fade.color;this.context.fillRect(0,0,width,height);this.context.restore();}
    this.canvas.dataset.cameraType=project.cameraType??'perspective';this.canvas.dataset.rendered='true';this.canvas.dataset.txIndex=String(pose.txIndex);this.canvas.dataset.look=model.material+'-'+project.background;this.canvas.dataset.shot=activeShot(project,time).kind;this.canvas.dataset.shadowReceiver='transparent';this.canvas.dataset.camera=JSON.stringify({position:pose.position.toArray(),target:pose.target.toArray(),fov:pose.fov,offset:!!this.camera.view?.enabled});this.canvas.dataset.localStyle=model.styleClip?.style&&Object.keys(model.styleClip.style).length?model.styleClip.id:'';
    this.canvas.dataset.model=model.transform?.kind??'static';this.canvas.dataset.physics=this.physics.pending?'preparing':bake?'ready':'idle';this.canvas.dataset.fade=String(fade.opacity);
  }
  private renderFogDepth(width:number,height:number){
    const fog=this.scene.fog;
    this.fx.uniforms.orthographic!.value=this.camera instanceof THREE.OrthographicCamera?1:0;
    this.fx.uniforms.fogEnabled!.value=fog instanceof THREE.Fog?1:0;
    if(fog instanceof THREE.Fog){
      if(this.fogDepth.width!==width||this.fogDepth.height!==height)this.fogDepth.setSize(width,height);
      const target=this.renderer.getRenderTarget(),override=this.scene.overrideMaterial,shadowEnabled=this.renderer.shadowMap.enabled;
      this.scene.overrideMaterial=this.fogDepthMaterial;this.renderer.shadowMap.enabled=false;
      try{this.renderer.setRenderTarget(this.fogDepth);this.renderer.setClearColor(0xffffff,1);this.renderer.clear();this.renderer.render(this.scene,this.camera);}
      finally{this.renderer.shadowMap.enabled=shadowEnabled;this.scene.overrideMaterial=override;this.renderer.setRenderTarget(target);this.renderer.setClearColor(0x000000,0);}
      this.fx.uniforms.tDepth!.value=this.fogDepth.texture;this.fx.uniforms.fogNear!.value=fog.near;this.fx.uniforms.fogFar!.value=fog.far;
      this.fx.uniforms.cameraNear!.value=this.camera.near;this.fx.uniforms.cameraFar!.value=this.camera.far;
      const color=fog.color.clone().convertLinearToSRGB();this.fx.uniforms.background!.value.set(color.r,color.g,color.b);
    }
  }
  processing(clip:import('./editor-model').ModelClip){return this.physics.status(clip);}
  prepare(project:Project,recalculate=false){const result=this.physics.prepare(project,recalculate);if(this.physics.pending)this.canvas.dataset.physics='preparing';return result;}
  get physicsProgress(){return this.physics.progress;}get physicsPending(){return this.physics.pending;}
  anchor(txIndex:number):Anchor{
    const index=this.parcelIndices.get(txIndex);if(index===undefined)return {x:0,y:0,visible:false};this.mesh.getMatrixAt(index,this.matrix);
    const point=this.anchorPoint.set(0,.5,0).applyMatrix4(this.matrix).project(this.camera);
    return {x:(point.x+1)/2*this.width,y:(1-point.y)/2*this.height,visible:point.z>=-1&&point.z<=1&&Math.abs(point.x)<.94&&Math.abs(point.y)<.94};
  }
  pick(clientX:number,clientY:number):number|null{
    if(!this.currentPose)return null;const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const i=ray.intersectObject(this.mesh)[0]?.instanceId;return i===undefined?null:this.data.layout.parcels[i]!.txIndex;
  }
  dispose(){
    this.disposed=true;this.physics.dispose();this.renderer.domElement.removeEventListener('webglcontextlost',this.lossHandler);this.mesh.dispose();Object.values(this.cubeGeometries).forEach(g=>g.dispose());Object.values(this.materials).forEach(m=>m.dispose());
    for(const mesh of [this.ground]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.grid.geometry.dispose();(this.grid.material as THREE.Material).dispose();this.key.shadow.dispose();
    for(const pass of this.composer.passes)pass.dispose();this.fogDepth.dispose();this.fogDepthMaterial.dispose();this.composer.dispose();this.renderer.dispose();this.renderer.forceContextLoss();
  }
}
