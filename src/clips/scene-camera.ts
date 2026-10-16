import type {Project} from '../editor-model';
export function applySceneCamera(project:Project,settings:Record<string,unknown>){
 const shot=project.shots[0]!;shot.camera.yawEnd=shot.camera.yawStart;shot.camera.distanceEnd=shot.camera.distanceStart;
 project.cameraSettings={cameraA:settings.cameraA as never,cameraB:settings.cameraB as never,animation:'none',rotation:settings.rotation?'rotating':'none',animationSpeed:Number(settings.rotationSpeed),zoomMode:settings.zoomEnabled?settings.zoomMode as never:'none',zoomStrength:Number(settings.cameraZoomStrength),zoomEasing:settings.cameraZoomEasing as never};
}
