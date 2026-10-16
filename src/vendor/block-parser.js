/*
 * recursive block parser ~ raw Bitcoin block (hex) -> JSON with transactions, witness data, Ordinals
 * inscriptions (tags decoded, destination address) and a type for every transaction.
 *
 *   const block = await parseBlock(hex, options) (parses existing block hex, no fetch)
 *   const block = await fetchBlock(height, options)   // fetches /r/block/<height>
 *   const list = listInscriptions(block)               // flat, in block order
 *
 *
 * Add ?origin=https://ordinals.com to this module's URL to prefix every fetch (local testing).
 *
 * Values are sats, hashes are byte-reversed like explorers show them, addresses are mainnet.
 *
 * Options:
 *   height             block height (coinbase/locktime labels, reserved rune names). fetchBlock sets it
 *   getOutputValue     async (txid, vout) => sats. Needed to place inscriptions and compute fees when
 *                      the spent output is not in this block
 *   lookupConcurrency  parallel getOutputValue calls (default 8, calls are deduplicated)
 *   fees               true: add fee and feeRate to each transaction
 *   runes              true | async (height) => block: resolve rune names for mints and transfers
 *   classify           false: skip kind, labels and input spend types
 *   locate             false: skip the inscription address lookup
 *
 * Per transaction: kind, summary, labels, value, fee, feeRate, coinbase, runestone, opReturns,
 * counterparty, atomicals. Per input: spend. Per output: scriptType. Per inscription: location,
 * address, media, and protocol/op/tick/amount for text. Bodies are not decompressed.
 *
 * Also exported for use elsewhere (hex strings or bytes are accepted where bytes are expected):
 *   decodeCbor, tryDecodeCbor           CBOR -> JS (byte strings as "0x..." hex, huge ints as strings)
 *   readScript                          script -> [{ opcode, data, isNumber? }], never throws
 *   scriptTypeOf                        'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'p2a' | 'op_return' | ...
 *   multisigInfo                        { m, n, keys } for a bare/redeem multisig script, else null
 *   inscriptionsFromScript              every ord envelope in one tapscript, decoded like parseBlock does
 *   decodeRunestone, runeName, formatRuneAmount   (runestone fields are BigInt)
 *   readProperties                      numeric property keys -> { title, traits, items: [{ id, title, traits }] }
 *   describeOpReturn                    label for known OP_RETURN protocols (takes the pushed data)
 *   toHex, fromHex, reverseHex          bytes <-> hex, and byte-reversed hex
 *   sha256d                             double SHA-256 (sync)
 *   addressOf                           mainnet address for an output script (hex or bytes), or null
 *   KINDS                               transaction kinds with labels and colors
 *
 */

// ?origin= query param to set URL beginnings, like https://ordinals.com
// Used by fetchBlock.
const url = new URL(import.meta.url);
const params = new URLSearchParams(url.search);
let originParam = params.get('origin');

// for local testing;
// originParam = 'https://ordinals.com'

export async function parseBlock(blockHex, options = {}) {
    const classify = options.classify !== false
    const bytes = fromHex(blockHex)
    const reader = new Reader(bytes)

    const header = {
        version: reader.int32(),
        prevHash: reverseHex(reader.read(32)),
        merkleRoot: reverseHex(reader.read(32)),
        time: reader.uint32(),
        bits: reader.uint32(),
        nonce: reader.uint32(),
    }
    const hash = reverseHex(sha256d(bytes.subarray(0, 80)))

    const txCount = reader.varint()
    const scriptCache = new Map()   // output script hex -> { scriptType, address }
    const txs = []
    for (let i = 0; i < txCount; i++) txs.push(parseTransaction(reader, i, scriptCache, classify))

    const values = makeValueLookup(txs, options.getOutputValue, options.lookupConcurrency)
    if (options.locate !== false) await locateInscriptions(txs, values)

    const block = {
        hash,
        ...header,
        timeISO: new Date(header.time * 1000).toISOString(),
        height: options.height ?? null,
        size: bytes.length,
        txCount,
        txs,
    }
    if (classify) await classifyBlock(block, values, options)
    return block
}

export async function fetchBlock(heightOrHash, options = {}) {
    if (/^\d+$/.test(String(heightOrHash))) options = { height: Number(heightOrHash), ...options }
    const response = await fetch(`${originParam || ''}/r/block/${heightOrHash}`)
    if (!response.ok) throw new Error(`/r/block/${heightOrHash} returned HTTP ${response.status}`)
    return parseBlock((await response.text()).replace(/"/g, ''), options)
}

export function listInscriptions(block) {
    const list = []
    for (const tx of block.txs) {
        for (const input of tx.inputs) {
            for (const inscription of input.witness?.inscriptions ?? []) {
                list.push({ txIndex: tx.index, txid: tx.txid, inputIndex: input.index, ...inscription })
            }
        }
    }
    return list
}

const SHA256_K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
const SHA256_START = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])

// Working memory, allocated once and reused (safe because hashing never waits for anything).
const sha256State = new Int32Array(8)
const sha256Words = new Int32Array(64)
const sha256Tail = new Uint8Array(128)

const rotateRight = (x, n) => (x >>> n) | (x << (32 - n))

// Mixes one 64 byte block (starting at `offset`) into the state.
function sha256Block(bytes, offset) {
    const w = sha256Words

    // Expand the 64 bytes into 64 words.
    for (let i = 0, j = offset; i < 16; i++, j += 4) {
        w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]
    }
    for (let i = 16; i < 64; i++) {
        const a = w[i - 15]
        const b = w[i - 2]
        const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3)
        const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10)
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }

    let a = sha256State[0], b = sha256State[1], c = sha256State[2], d = sha256State[3]
    let e = sha256State[4], f = sha256State[5], g = sha256State[6], h = sha256State[7]
    for (let i = 0; i < 64; i++) {
        const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
        const choose = (e & f) ^ (~e & g)
        const temp1 = (h + S1 + choose + SHA256_K[i] + w[i]) | 0
        const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
        const majority = (a & b) ^ (a & c) ^ (b & c)
        const temp2 = (S0 + majority) | 0
        h = g; g = f; f = e; e = (d + temp1) | 0
        d = c; c = b; b = a; a = (temp1 + temp2) | 0
    }

    sha256State[0] += a; sha256State[1] += b; sha256State[2] += c; sha256State[3] += d
    sha256State[4] += e; sha256State[5] += f; sha256State[6] += g; sha256State[7] += h
}

export function sha256(data) {
    sha256State.set(SHA256_START)

    // Whole 64 byte blocks are hashed straight from the input.
    const length = data.length
    const completeBytes = length - (length % 64)
    for (let offset = 0; offset < completeBytes; offset += 64) sha256Block(data, offset)

    // The rest, a 1 bit, zeros and the length in bits (64 bit, big endian) fit in one or two blocks.
    const rest = length - completeBytes
    const tail = sha256Tail
    tail.fill(0)
    for (let i = 0; i < rest; i++) tail[i] = data[completeBytes + i]
    tail[rest] = 0x80

    const tailLength = rest < 56 ? 64 : 128
    const bitsHigh = Math.floor((length * 8) / 2 ** 32)
    const bitsLow = (length * 8) % 2 ** 32
    for (let i = 0; i < 4; i++) {
        tail[tailLength - 8 + i] = bitsHigh >>> (24 - i * 8)
        tail[tailLength - 4 + i] = bitsLow >>> (24 - i * 8)
    }
    sha256Block(tail, 0)
    if (tailLength === 128) sha256Block(tail, 64)

    const out = new Uint8Array(32)
    for (let i = 0; i < 8; i++) {
        const word = sha256State[i]
        out[i * 4] = word >>> 24
        out[i * 4 + 1] = word >>> 16
        out[i * 4 + 2] = word >>> 8
        out[i * 4 + 3] = word
    }
    return out
}

export const sha256d = (bytes) => sha256(sha256(bytes))

function parseTransaction(reader, index, scriptCache, withSpend) {
    const bytes = reader.bytes
    const start = reader.pos
    const version = reader.int32()

    // Segwit transactions have a 0x00 0x01 marker after the version.
    const isSegwit = bytes[reader.pos] === 0x00 && bytes[reader.pos + 1] === 0x01
    if (isSegwit) reader.read(2)
    const bodyStart = reader.pos

    const inputs = []
    const scriptSigs = []
    const inputCount = reader.varint()
    for (let i = 0; i < inputCount; i++) {
        const txid = reverseHex(reader.read(32))
        const vout = reader.uint32()
        const scriptSig = reader.read(reader.varint())
        const sequence = reader.uint32()
        scriptSigs.push(scriptSig)
        inputs.push({ index: i, txid, vout, scriptSig: toHex(scriptSig), sequence, witness: null, spend: null })
    }

    const outputs = []
    const outputCount = reader.varint()
    for (let i = 0; i < outputCount; i++) {
        const value = reader.uint64()
        const script = toHex(reader.read(reader.varint()))
        let described = scriptCache.get(script)
        if (!described) scriptCache.set(script, (described = describeOutput(fromHex(script))))
        outputs.push({ index: i, value, script, scriptType: described.scriptType, address: described.address })
    }
    const bodyEnd = reader.pos

    // Segwit: one witness stack per input, after the outputs.
    const stacks = []
    if (isSegwit) {
        for (const input of inputs) {
            const items = readWitnessStack(reader)
            stacks.push(items)
            input.witness = describeWitness(items)
        }
    }
    if (withSpend) {
        inputs.forEach((input, i) => {
            input.spend = index === 0 ? COINBASE_SPEND : describeSpend(stacks[i] ?? [], scriptSigs[i])
        })
    }

    const locktime = reader.uint32()
    const end = reader.pos

    // The txid hashes the transaction without marker and witness.
    const withoutWitness = isSegwit
        ? concat([bytes.subarray(start, start + 4), bytes.subarray(bodyStart, bodyEnd), bytes.subarray(end - 4, end)])
        : bytes.subarray(start, end)
    const size = end - start
    const weight = withoutWitness.length * 3 + size

    const txid = reverseHex(sha256d(withoutWitness))
    const tx = { index, txid, isCoinbase: index === 0, version, locktime, size, weight, vsize: Math.ceil(weight / 4), inputs, outputs }
    numberInscriptions(tx)
    return tx
}

function numberInscriptions(tx) {
    let n = 0
    for (const input of tx.inputs) {
        for (const inscription of input.witness?.inscriptions ?? []) inscription.id = `${tx.txid}i${n++}`
    }
}

export function scriptTypeOf(script) {
    script = toBytes(script)
    const n = script.length
    if (n === 25 && script[0] === 0x76 && script[1] === 0xa9 && script[2] === 20 && script[23] === 0x88 && script[24] === 0xac) return 'p2pkh'
    if (n === 23 && script[0] === 0xa9 && script[1] === 20 && script[22] === 0x87) return 'p2sh'

    // Witness program: OP_0 or OP_1..OP_16, then a 2 to 40 byte push.
    const version = script[0] === 0x00 ? 0 : script[0] >= 0x51 && script[0] <= 0x60 ? script[0] - 0x50 : null
    if (version !== null && n >= 4 && n <= 42 && script[1] === n - 2) {
        if (version === 1 && n === 4 && script[2] === 0x4e && script[3] === 0x73) return 'p2a'
        if (version === 0) return n === 22 ? 'p2wpkh' : n === 34 ? 'p2wsh' : 'nonstandard'
        if (version === 1 && n === 34) return 'p2tr'
        return `witness-v${version}`
    }

    if (n > 0 && script[0] === 0x6a) return 'op_return'
    if ((n === 35 && script[0] === 33 && script[34] === 0xac) || (n === 67 && script[0] === 65 && script[66] === 0xac)) return 'p2pk'
    return multisigInfo(script) ? 'multisig' : 'nonstandard'
}

function describeOutput(script) {
    const scriptType = scriptTypeOf(script)
    return { scriptType, address: addressOf(script, scriptType) }
}

// Mainnet address of an output script, or null where there is none (OP_RETURN, P2PK, multisig, ...).
export function addressOf(script, scriptType) {
    script = toBytes(script)
    scriptType ??= scriptTypeOf(script)
    if (scriptType === 'p2pkh') return base58check(0x00, script.subarray(3, 23))
    if (scriptType === 'p2sh') return base58check(0x05, script.subarray(2, 22))
    if (scriptType === 'p2wpkh' || scriptType === 'p2wsh') return segwitAddress(0, script.subarray(2))
    if (scriptType === 'p2tr' || scriptType === 'p2a') return segwitAddress(1, script.subarray(2))
    if (scriptType.startsWith('witness-v')) return segwitAddress(script[0] - 0x50, script.subarray(2))
    return null
}

// Legacy addresses: version byte + 20 byte hash + 4 byte checksum, written in base58.
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58check(versionByte, hash) {
    const payload = concat([Uint8Array.of(versionByte), hash])
    const bytes = concat([payload, sha256d(payload).subarray(0, 4)])

    // Convert base 256 to base 58 one byte at a time. `digits` is least significant first.
    const digits = []
    for (const byte of bytes) {
        let carry = byte
        for (let i = 0; i < digits.length; i++) {
            carry += digits[i] * 256
            digits[i] = carry % 58
            carry = Math.floor(carry / 58)
        }
        while (carry > 0) {
            digits.push(carry % 58)
            carry = Math.floor(carry / 58)
        }
    }

    let text = ''
    for (const byte of bytes) {   // every leading zero byte is written as a "1"
        if (byte !== 0) break
        text += '1'
    }
    for (let i = digits.length - 1; i >= 0; i--) text += BASE58[digits[i]]
    return text
}

// Segwit addresses: bech32 for version 0, bech32m for versions 1 and up.
const BECH32_CHARS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod(values) {
    const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    let checksum = 1
    for (const value of values) {
        const top = checksum >>> 25
        checksum = ((checksum & 0x1ffffff) << 5) ^ value
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) checksum ^= generators[i]
        }
    }
    return checksum >>> 0
}

function segwitAddress(version, program) {
    // Regroup the program's 8 bit bytes into 5 bit values.
    const data = [version]
    let buffer = 0
    let bits = 0
    for (const byte of program) {
        buffer = ((buffer << 8) | byte) & 0xfff
        bits += 8
        while (bits >= 5) {
            bits -= 5
            data.push((buffer >> bits) & 31)
        }
    }
    if (bits > 0) data.push((buffer << (5 - bits)) & 31)

    // Add the 6 value checksum. [3, 3, 0, 2, 3] is the human readable part "bc" expanded.
    const constant = version === 0 ? 1 : 0x2bc830a3
    const checksum = bech32Polymod([3, 3, 0, 2, 3, ...data, 0, 0, 0, 0, 0, 0]) ^ constant
    for (let i = 0; i < 6; i++) data.push((checksum >>> (5 * (5 - i))) & 31)

    return 'bc1' + data.map((value) => BECH32_CHARS[value]).join('')
}

function readWitnessStack(reader) {
    const items = []
    const count = reader.varint()
    for (let i = 0; i < count; i++) items.push(reader.read(reader.varint()))
    return items
}

// A control block is 33 bytes plus 32 per merkle step, starting 0xc0 or 0xc1.
const isControlBlock = (item) => item.length >= 33 && (item.length - 33) % 32 === 0 && (item[0] & 0xfe) === 0xc0

// Splits off an optional taproot annex (a last item starting 0x50).
function splitAnnex(items) {
    const hasAnnex = items.length >= 2 && items[items.length - 1][0] === 0x50
    return { stack: hasAnnex ? items.slice(0, -1) : items, annex: hasAnnex ? items[items.length - 1] : null }
}

function describeWitness(items) {
    if (items.length === 0) return null
    const result = { items: items.map((item) => toHex(item)) }
    const { stack, annex } = splitAnnex(items)
    if (annex) result.annex = toHex(annex)
    const last = stack[stack.length - 1]

    // Taproot script path: [...args, script, controlBlock]. Inscriptions and Atomicals live here.
    if (stack.length >= 2 && isControlBlock(last)) {
        const script = stack[stack.length - 2]
        const ops = mayHoldEnvelope(script) ? readScript(script) : []
        return {
            ...result,
            type: 'taproot-script-path',
            controlBlock: toHex(last),
            internalKey: toHex(last.subarray(1, 33)),
            script: toHex(script),
            inscriptions: findInscriptions(ops),
            atomicals: findAtomicals(ops),
        }
    }
    if (stack.length === 1 && (last.length === 64 || last.length === 65)) {
        return { ...result, type: 'taproot-key-path', signature: toHex(last) }
    }
    if (stack.length === 2 && stack[0][0] === 0x30 && (last.length === 33 || last.length === 65)) {
        return { ...result, type: 'p2wpkh', signature: toHex(stack[0]), publicKey: toHex(last) }
    }
    return { ...result, type: 'other', witnessScript: toHex(last) }   // P2WSH, multisig, ...
}

// Cheap byte scan: can this script hold an "ord" or "atom" envelope at all? Nearly none can.
function mayHoldEnvelope(script) {
    for (let i = 0; i + 2 < script.length; i++) {
        if (script[i] === 0x6f && script[i + 1] === 0x72 && script[i + 2] === 0x64) return true
        if (script[i] === 0x61 && script[i + 1] === 0x74 && script[i + 2] === 0x6f && script[i + 3] === 0x6d) return true
    }
    return false
}

const COINBASE_SPEND = { type: 'coinbase', sighash: null, multisig: null, htlc: false, annex: false }

// What kind of input is this? Works for legacy, segwit and taproot inputs.
export function describeSpend(items, scriptSig) {
    const spend = { type: 'unknown', sighash: null, multisig: null, htlc: false, annex: false }

    if (items.length === 0) {   // nested P2SH-P2WPKH has no witness here, legacy inputs neither
        const nestedP2wpkh = scriptSig.length === 23 && scriptSig[0] === 0x16 && scriptSig[1] === 0x00 && scriptSig[2] === 0x14
        return { ...spend, type: nestedP2wpkh ? 'p2sh-p2wpkh' : legacyInputType(scriptSig) }
    }

    const { stack, annex } = splitAnnex(items)
    spend.annex = annex !== null
    const last = stack[stack.length - 1]

    if (stack.length >= 2 && isControlBlock(last)) return { ...spend, type: 'p2tr-script' }
    if (stack.length === 1 && (last.length === 64 || last.length === 65)) {
        return { ...spend, type: 'p2tr-key', sighash: last.length === 65 ? last[64] : 0 }
    }

    const nested = scriptSig.length > 0
    const first = stack[0]
    const isDer = first.length >= 9 && first.length <= 73 && first[0] === 0x30 && first[1] === first.length - 3 && first[2] === 0x02
    if (stack.length === 2 && isDer && (last.length === 33 || last.length === 65)) {
        return { ...spend, type: nested ? 'p2sh-p2wpkh' : 'p2wpkh', sighash: first[first.length - 1] }
    }

    const multisig = multisigInfo(last)   // otherwise the last item is a witness script
    return {
        ...spend,
        type: nested ? 'p2sh-p2wsh' : 'p2wsh',
        multisig: multisig ? `${multisig.m}-of-${multisig.n}` : null,
        htlc: hasHtlcShape(last),
    }
}

function legacyInputType(scriptSig) {
    if (scriptSig.length === 0) return 'unknown'
    const ops = readScript(scriptSig)
    if (ops.length === 2 && ops[0].data && ops[1].data && (ops[1].data.length === 33 || ops[1].data.length === 65)) return 'p2pkh'
    if (ops.length === 1 && ops[0].data && ops[0].data.length >= 9 && ops[0].data[0] === 0x30) return 'p2pk'

    const redeemScript = ops[ops.length - 1]
    const multisig = ops[0]?.opcode === 0x00 && redeemScript?.data ? multisigInfo(redeemScript.data) : null
    if (multisig) return `p2sh-multisig-${multisig.m}-of-${multisig.n}`
    return ops.length > 1 ? 'p2sh' : 'unknown'
}

// OP_m <33 or 65 byte keys> OP_n OP_CHECKMULTISIG -> { m, n, keys }, or null.
export function multisigInfo(script) {
    if (script.length < 37 || script[script.length - 1] !== 0xae) return null
    const ops = readScript(script)
    const smallNumber = (op) => (op && op.opcode >= 0x51 && op.opcode <= 0x60 ? op.opcode - 0x50 : -1)
    const m = smallNumber(ops[0])
    const n = smallNumber(ops[ops.length - 2])
    const keys = ops.slice(1, -2)
    if (m < 1 || n < 1 || keys.length !== n) return null
    if (!keys.every((key) => key.data && (key.data.length === 33 || key.data.length === 65))) return null
    return { m, n, keys: keys.map((key) => key.data) }
}

// Lightning HTLCs mix a hash check, a timelock and OP_IF.
function hasHtlcShape(script) {
    const has = (byte) => script.includes(byte)
    return script.length > 40 && (has(0xa9) || has(0xa8)) && (has(0xb2) || has(0xb1)) && has(0x63)
}

/*
 * An inscription is an envelope inside a tapscript that never executes:
 *   OP_FALSE OP_IF "ord" <tag> <value> ... OP_0 <body chunk> ... OP_ENDIF
 *
 * Tags: 1 content type, 2 pointer, 3 parent (repeatable), 5 metadata (CBOR, chunked),
 * 7 metaprotocol, 9 content encoding, 11 delegate, 13 rune, 15 note (ignored by ord),
 * 17 properties (CBOR, chunked), 19 property encoding, 66 unbound. Others go to unknownFields.
 */

const OP_FALSE = 0x00
const OP_IF = 0x63
const OP_ENDIF = 0x68
const ORD_TAG = [0x6f, 0x72, 0x64]
const ATOM_TAG = [0x61, 0x74, 0x6f, 0x6d]

const startsEnvelope = (ops, i, tag) =>
    ops[i].opcode === OP_FALSE && ops[i + 1].opcode === OP_IF && ops[i + 2].data !== null && equalsBytes(ops[i + 2].data, tag)

export function findInscriptions(ops) {
    const inscriptions = []
    for (let i = 0; i + 2 < ops.length; i++) {
        if (!startsEnvelope(ops, i, ORD_TAG)) continue
        const { inscription, endIndex } = readEnvelope(ops, i + 3)
        inscriptions.push(inscription)
        i = endIndex   // a script can hold several envelopes
    }
    return inscriptions
}

// Inscriptions in a single tapscript (hex or bytes), for use outside parseBlock.
export const inscriptionsFromScript = (script) => findInscriptions(readScript(script))

// Atomicals: OP_FALSE OP_IF "atom" <operation> <CBOR payload> ... OP_ENDIF
function findAtomicals(ops) {
    const found = []
    for (let i = 0; i + 3 < ops.length; i++) {
        if (startsEnvelope(ops, i, ATOM_TAG)) found.push({ op: ops[i + 3].data ? toText(ops[i + 3].data) : '?' })
    }
    return found
}

function readEnvelope(ops, startIndex) {
    const inscription = {
        address: null,            // filled in by locateInscriptions
        location: null,
        contentType: null,
        contentEncoding: null,
        hasContentEncoding: false, // Local: preserve presence even for empty values.
        metaprotocol: null,
        pointer: null,
        parents: [],
        delegate: null,
        hasDelegate: false, // Local: preserve presence even if the value is malformed.
        rune: null,               // string, can exceed a JS number
        note: null,
        metadata: null,
        metadataHex: null,
        properties: null,         // raw decoded CBOR, keyed by number
        propertiesHex: null,
        propertyEncoding: null,
        title: null,              // properties, with their names (see readProperties)
        traits: null,             // { name: value }
        gallery: [],              // inscription ids in the gallery
        galleryItems: [],         // { id, title, traits } for each gallery item
        unknownFields: [],
        duplicateTags: [],        // scalar tags seen twice (first wins, like ord)
        unbound: false,
        pushnum: false,           // OP_1..OP_16 used as data (ord: cursed)
        complete: false,          // false if the script ended before OP_ENDIF
        bodyLength: 0,
        text: null,               // body as text if valid UTF-8
        bodyHex: '',
    }

    const bodyChunks = []
    const metadataChunks = []
    const propertyChunks = []
    let inBody = false
    let i = startIndex

    const setOnce = (name, value) => {
        if (inscription[name] === null) inscription[name] = value
        else inscription.duplicateTags.push(name)
    }

    for (; i < ops.length; i++) {
        const op = ops[i]
        if (op.opcode === OP_ENDIF) { inscription.complete = true; break }

        if (inBody) {
            if (op.data) bodyChunks.push(op.data)
            if (op.isNumber) inscription.pushnum = true
            continue
        }
        if (op.opcode === OP_FALSE) { inBody = true; continue }   // empty push: body starts

        // Otherwise a tag, followed by its value.
        const value = ops[i + 1]
        if (!op.data || !value || !value.data) continue
        i++
        if (op.isNumber || value.isNumber) inscription.pushnum = true

        const tag = op.data.length === 1 ? op.data[0] : null
        switch (tag) {
            case 1: setOnce('contentType', toText(value.data)); break
            case 2: setOnce('pointer', littleEndian(value.data)); break
            case 3: inscription.parents.push(inscriptionIdFromBytes(value.data)); break
            case 5: metadataChunks.push(value.data); break
            case 7: setOnce('metaprotocol', toText(value.data)); break
            case 9: inscription.hasContentEncoding = true; setOnce('contentEncoding', toText(value.data)); break
            case 11: inscription.hasDelegate = true; setOnce('delegate', inscriptionIdFromBytes(value.data)); break
            case 13: setOnce('rune', littleEndianBig(value.data).toString()); break
            case 15: setOnce('note', toText(value.data)); break
            case 17: propertyChunks.push(value.data); break
            case 19: setOnce('propertyEncoding', toText(value.data)); break
            case 66: inscription.unbound = true; break
            default: inscription.unknownFields.push({ tag: tag ?? toHex(op.data), value: toHex(value.data) })
        }
    }

    const body = concat(bodyChunks)
    inscription.bodyLength = body.length
    inscription.bodyHex = toHex(body)
    inscription.text = toTextOrNull(body)

    if (metadataChunks.length) {
        const bytes = concat(metadataChunks)
        inscription.metadataHex = toHex(bytes)
        inscription.metadata = tryDecodeCbor(bytes)
    }
    if (propertyChunks.length) {
        const bytes = concat(propertyChunks)
        inscription.propertiesHex = toHex(bytes)
        if (!inscription.propertyEncoding) {   // compressed properties stay as hex
            inscription.properties = tryDecodeCbor(bytes)
            const named = readProperties(inscription.properties)
            inscription.title = named.title
            inscription.traits = named.traits
            inscription.galleryItems = named.items
            inscription.gallery = named.items.map((item) => item.id)
        }
    }
    return { inscription, endIndex: i }
}

// Splits a script into operations. `data` is the pushed bytes (null for other ops). Never throws.
export function readScript(bytes) {
    bytes = toBytes(bytes)
    const ops = []
    let i = 0
    while (i < bytes.length) {
        const opcode = bytes[i++]
        let size = null
        if (opcode >= 0x01 && opcode <= 0x4b) size = opcode
        else if (opcode === 0x4c) { size = bytes[i]; i += 1 }
        else if (opcode === 0x4d) { size = bytes[i] | (bytes[i + 1] << 8); i += 2 }
        else if (opcode === 0x4e) { size = (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0; i += 4 }

        if (size !== null) {
            ops.push({ opcode, data: bytes.subarray(i, i + size) })
            i += size
        } else if (opcode === 0x00) {
            ops.push({ opcode, data: new Uint8Array(0) })
        } else if (opcode === 0x4f) {
            ops.push({ opcode, data: Uint8Array.of(0x81), isNumber: true })              // OP_1NEGATE
        } else if (opcode >= 0x51 && opcode <= 0x60) {
            ops.push({ opcode, data: Uint8Array.of(opcode - 0x50), isNumber: true })     // OP_1..OP_16
        } else {
            ops.push({ opcode, data: null })
        }
    }
    return ops
}

// Parent/delegate ids: 32 reversed txid bytes plus an index with trailing zeros dropped (32 to 36 bytes).
export function inscriptionIdFromBytes(bytes) {
    if (bytes.length < 32 || bytes.length > 36) return toHex(bytes)
    return `${reverseHex(bytes.subarray(0, 32))}i${littleEndian(bytes.subarray(32))}`
}

const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

// Attributes = { 0: title, 1: traits }, where traits is a map of names to values.
const readAttributes = (map) => ({
    title: typeof map?.[0] === 'string' ? map[0] : null,
    traits: isMap(map?.[1]) ? map[1] : null,
})

/*
 * Gives the numeric property keys their names (properties are CBOR maps keyed by small integers):
 *   Properties = { 0: [gallery items], 1: attributes, 2: packed txids }
 *   Item       = { 0: inscription id, 1: attributes, 2: index into packed txids }
 *   Attributes = { 0: title, 1: traits }
 * An item names its inscription either inline (key 0 holds the 32 to 36 byte id) or packed
 * (Properties key 2 holds all txids back to back and the item's key 2 holds its index).
 * Returns { title, traits, items: [{ id, title, traits }] }.
 */
export function readProperties(properties) {
    if (!isMap(properties)) return { title: null, traits: null, items: [] }

    // Current ord keeps title and traits under key 1. Some drafts put them directly on the map.
    const nested = isMap(properties[1]) && (typeof properties[1][0] === 'string' || isMap(properties[1][1]))
    const { title, traits } = readAttributes(nested ? properties[1] : properties)

    const packedTxids = bytesFromCbor(properties[2])
    const items = []
    ;(Array.isArray(properties[0]) ? properties[0] : []).forEach((item, i) => {
        if (!isMap(item)) return
        const inline = bytesFromCbor(item[0])
        let id = null
        if (inline && inline.length >= 32 && inline.length <= 36) {
            id = inscriptionIdFromBytes(inline)
        } else if (packedTxids && packedTxids.length >= (i + 1) * 32) {
            id = `${reverseHex(packedTxids.subarray(i * 32, (i + 1) * 32))}i${Number.isInteger(item[2]) ? item[2] : 0}`
        }
        if (id) items.push({ id, ...readAttributes(item[1]) })
    })
    return { title, traits, items }
}

// decodeCbor shows byte strings as "0x..." hex. This turns one back into bytes, or null.
function bytesFromCbor(value) {
    if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})*$/.test(value)) return null
    return fromHex(value.slice(2))
}

/*
 * Ord puts an inscription on one sat of the reveal: the sat at `pointer` if it falls inside the
 * outputs, otherwise the first sat of the input carrying the envelope (the sum of the earlier input
 * values). Following that sat through the outputs gives the output and address.
 *
 * location.status: 'output' | 'burned' (OP_RETURN) | 'fee' (past the outputs) | 'unknown' (an earlier
 * input value could not be found)
 */

// Value of the output an input spends: from this block, else from the caller's getOutputValue.
function makeValueLookup(txs, getOutputValue, concurrency) {
    const outputValues = new Map(txs.map((tx) => [tx.txid, tx.outputs.map((output) => output.value)]))
    const cache = new Map()   // "txid:vout" -> promise of sats or null
    const parallel = Math.max(1, Number(concurrency) || 8)

    const inBlock = (input) => outputValues.get(input.txid)?.[input.vout]

    async function get(input) {
        const local = inBlock(input)
        if (local !== undefined) return local
        if (!getOutputValue) return null
        const key = `${input.txid}:${input.vout}`
        if (!cache.has(key)) {
            cache.set(key, Promise.resolve()
                .then(() => getOutputValue(input.txid, input.vout))
                .then((value) => value ?? null, () => null))
        }
        return cache.get(key)
    }

    // Warm the cache for many inputs, a few at a time.
    async function prefetch(inputs) {
        if (!getOutputValue) return
        const todo = inputs.filter((input) => inBlock(input) === undefined)
        let next = 0
        const worker = async () => { while (next < todo.length) await get(todo[next++]) }
        await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker))
    }

    return { inBlock, get, prefetch }
}

async function locateInscriptions(txs, values) {
    // First collect every earlier input value we will need, so lookups run together.
    const reveals = []
    const wanted = []
    for (const tx of txs) {
        if (tx.isCoinbase) continue
        const items = tx.inputs.flatMap((input) => (input.witness?.inscriptions ?? []).map((inscription) => ({ input, inscription })))
        if (!items.length) continue

        const total = tx.outputs.reduce((sum, output) => sum + output.value, 0)
        const needed = Math.max(0, ...items.filter(({ inscription }) => !usesPointer(inscription, total)).map(({ input }) => input.index))
        for (const input of tx.inputs.slice(0, needed)) wanted.push(input)
        reveals.push({ tx, items, total })
    }
    await values.prefetch(wanted)

    for (const { tx, items, total } of reveals) {
        for (const { input, inscription } of items) {
            inscription.location = await placeInscription(tx, input.index, inscription.pointer, total, values)
            inscription.address = inscription.location.address
        }
    }
}

const usesPointer = (inscription, total) => inscription.pointer !== null && inscription.pointer < total

async function placeInscription(tx, inputIndex, pointer, total, values) {
    let offset = 0
    let source = 'input-offset'
    if (pointer !== null && pointer < total) {
        offset = pointer
        source = 'pointer'
    } else {
        for (const earlier of tx.inputs.slice(0, inputIndex)) {
            const value = await values.get(earlier)
            if (value === null) return { status: 'unknown', source, address: null, missing: `${earlier.txid}:${earlier.vout}` }
            offset += value
        }
    }

    let start = 0
    for (const output of tx.outputs) {
        if (offset < start + output.value) {
            const burned = output.scriptType === 'op_return'
            return {
                status: burned ? 'burned' : 'output',
                source,
                outputIndex: output.index,
                offset: offset - start,
                value: output.value,
                scriptType: output.scriptType,
                address: burned ? null : output.address,
            }
        }
        start += output.value
    }
    return { status: 'fee', source, address: null }
}

// Earlier in this list wins when a transaction fits several kinds.
export const KINDS = {
    coinbase: { label: 'Coinbase', color: '#fff1a8' },
    rune: { label: 'Runes', color: '#ff4d6d' },
    brc20: { label: 'BRC-20', color: '#22d3ee' },
    inscription_image: { label: 'Image inscription', color: '#a855f7' },
    inscription: { label: 'Inscription', color: '#7c83ff' },
    atomicals: { label: 'Atomicals', color: '#2563eb' },
    stamp: { label: 'Stamps / Counterparty', color: '#a3e635' },
    opreturn: { label: 'OP_RETURN data', color: '#94a3b8' },
    market: { label: 'Marketplace trade', color: '#e879f9' },
    ordinal_transfer: { label: 'Ordinal / rune transfer', color: '#c4b5fd' },
    lightning: { label: 'Lightning', color: '#facc15' },
    coinjoin: { label: 'CoinJoin', color: '#4ade80' },
    consolidation: { label: 'Consolidation', color: '#14b8a6' },
    batch: { label: 'Batch payment', color: '#3b82f6' },
    payment: { label: 'Payment', color: '#e8901f' },
}
const KIND_RANK = Object.fromEntries(Object.keys(KINDS).map((kind, i) => [kind, i]))

const POSTAGE = new Set([330, 546, 600, 1000, 10000])
const COINJOIN_POOLS = new Set([50_000, 100_000, 1_000_000, 5_000_000, 50_000_000])
const SIGHASH_NAMES = { 0x01: 'ALL', 0x02: 'NONE', 0x03: 'SINGLE', 0x81: 'ALL|ANYONECANPAY', 0x82: 'NONE|ANYONECANPAY', 0x83: 'SINGLE|ANYONECANPAY' }

const SPEND_LABEL = {
    'p2tr-key': 'Taproot key-path', 'p2tr-script': 'Taproot script-path', p2wpkh: 'P2WPKH', 'p2sh-p2wpkh': 'Nested SegWit (P2SH-P2WPKH)',
    p2wsh: 'P2WSH', 'p2sh-p2wsh': 'Nested P2WSH', p2pkh: 'Legacy P2PKH', p2pk: 'P2PK', p2sh: 'Legacy P2SH', unknown: 'Unknown',
}
const OUTPUT_LABEL = {
    p2pkh: 'P2PKH', p2sh: 'P2SH', p2wpkh: 'P2WPKH', p2wsh: 'P2WSH', p2tr: 'P2TR', p2a: 'P2A anchor',
    op_return: 'OP_RETURN', p2pk: 'P2PK', multisig: 'Bare multisig', nonstandard: 'Non-standard',
}
const PROTOCOL_LABEL = {
    bitmap: 'Bitmap claim (.bitmap)', 'sats-name': 'Sats name (.sats)', sns: 'SNS name', name: 'Name inscription',
    tap: 'TAP protocol', 'brc-100': 'BRC-100', 'orc-20': 'ORC-20', 'brc-420': 'BRC-420',
}
const MEDIA_LABEL = {
    image: 'Image', svg: 'SVG', model: '3D model', audio: 'Audio', video: 'Video', html: 'HTML', js: 'JavaScript',
    css: 'CSS', json: 'JSON', text: 'Text', pdf: 'PDF', font: 'Font', binary: 'Binary', none: 'No content', delegate: 'Delegate',
}

// Adds kind, labels, fees and decoded details to every transaction, and totals to the block.
async function classifyBlock(block, values, options) {
    const kindCounts = {}
    let knownFees = 0
    const runeInfo = await resolveRunes(block, options.runes)

    const lookupFees = options.fees === true && typeof options.getOutputValue === 'function'
    if (lookupFees) await values.prefetch(block.txs.filter((tx) => !tx.isCoinbase).flatMap((tx) => tx.inputs))

    for (const tx of block.txs) {
        const result = classifyTx(tx, block.height, runeInfo)

        let fee = null
        if (!tx.isCoinbase) {
            let inputTotal = 0
            for (const input of tx.inputs) {
                const value = lookupFees ? await values.get(input) : (values.inBlock(input) ?? null)
                if (value === null) { inputTotal = null; break }
                inputTotal += value
            }
            if (inputTotal !== null) {
                fee = inputTotal - result.value
                knownFees++
                result.labels.push(`Fee ${(fee / tx.vsize).toFixed(1)} sat/vB`)
            }
        }

        Object.assign(tx, {
            kind: result.kind,
            summary: result.summary,
            labels: result.labels,
            value: result.value,
            fee,
            feeRate: fee === null ? null : fee / tx.vsize,
            coinbase: result.coinbase ?? null,
            runestone: result.runestone ?? null,
            opReturns: result.opReturns ?? null,
            counterparty: result.counterparty ?? null,
            atomicals: result.atomicals ?? null,
        })
        kindCounts[tx.kind] = (kindCounts[tx.kind] ?? 0) + 1
    }

    block.pool = block.txs[0]?.coinbase?.pool ?? null
    block.subsidy = block.height === null ? null : subsidyAt(block.height)
    block.totalFees = block.subsidy === null ? null : Math.max(0, (block.txs[0]?.value ?? 0) - block.subsidy)
    block.knownFees = knownFees
    block.kindCounts = kindCounts
}

export function subsidyAt(height) {
    const halvings = Math.floor(height / 210000)
    return halvings >= 64 ? 0 : Math.floor(5_000_000_000 / 2 ** halvings)
}

function classifyTx(tx, height, runeInfo) {
    const ctx = { tx, height, runeInfo, kind: 'payment', labels: [], summaries: {}, info: {} }
    ctx.setKind = (candidate, summary) => {
        if (summary && !ctx.summaries[candidate]) ctx.summaries[candidate] = summary
        if (KIND_RANK[candidate] < KIND_RANK[ctx.kind]) ctx.kind = candidate
    }
    ctx.value = tx.outputs.reduce((sum, output) => sum + output.value, 0)
    ctx.inscriptions = tx.inputs.flatMap((input) => input.witness?.inscriptions ?? [])
    // OP_RETURN outputs with their pushed data.
    ctx.carriers = tx.outputs
        .filter((output) => output.scriptType === 'op_return')
        .map((output) => ({ index: output.index, data: opReturnPayload(fromHex(output.script)) }))

    if (tx.isCoinbase) labelCoinbase(ctx)
    labelInscriptions(ctx)
    labelAtomicals(ctx)
    labelOpReturns(ctx)
    labelCounterparty(ctx)
    labelInputs(ctx)
    labelTimelocks(ctx)
    labelLightning(ctx)
    labelShape(ctx)
    labelOutputs(ctx)

    if (ctx.info.runestone) ctx.info.runestone = bigIntsToStrings(ctx.info.runestone)   // JSON friendly
    const inputCount = tx.inputs.length
    return {
        kind: ctx.kind,
        summary: ctx.summaries[ctx.kind] ?? (ctx.kind === 'payment' ? `Payment ${inputCount} â†’ ${tx.outputs.length}` : ctx.labels[0]),
        labels: [...new Set(ctx.labels)],
        value: ctx.value,
        ...ctx.info,
    }
}

function labelCoinbase({ tx, height, labels, info, setKind }) {
    info.coinbase = decodeCoinbase(tx)
    setKind('coinbase', info.coinbase.pool ? `Coinbase (${info.coinbase.pool})` : 'Coinbase')
    labels.push('Coinbase')
    if (info.coinbase.pool) labels.push(`Mined by ${info.coinbase.pool}`)

    const claimed = info.coinbase.bip34Height
    const plausible = height === null || height === undefined ? claimed < 5_000_000 : claimed === height
    if (claimed !== null && plausible) labels.push(`BIP34 height ${claimed}`)
    else info.coinbase.bip34Height = null
    labels.push(...info.coinbase.extras)
}

function labelInscriptions({ inscriptions, labels, setKind }) {
    if (!inscriptions.length) return
    for (const inscription of inscriptions) describeInscription(inscription)

    const brc20 = inscriptions.filter((i) => i.protocol === 'brc-20')
    const visuals = inscriptions.filter((i) => i.media === 'image' || i.media === 'svg')
    const first = inscriptions[0]

    if (brc20.length) {
        for (const b of brc20.slice(0, 3)) {
            const label = `BRC-20 ${b.op ?? '?'} ${b.tick ?? ''}${b.amount != null ? ` ${b.amount}` : ''}`.trim()
            labels.push(label)
            setKind('brc20', label)
        }
    } else if (visuals.length) {
        setKind('inscription_image', visuals.length > 1 ? `${visuals.length} image inscriptions` : `${MEDIA_LABEL[visuals[0].media]} inscription (${visuals[0].contentType})`)
    } else {
        const protocol = first.protocol && (PROTOCOL_LABEL[first.protocol] ?? `${first.protocol} inscription`)
        const fallback = first.media === 'delegate' ? 'Delegate inscription' : `${MEDIA_LABEL[first.media]} inscription${first.contentType ? ` (${first.contentType})` : ''}`
        setKind('inscription', protocol || fallback)
    }

    labels.push(inscriptions.length > 1 ? `${inscriptions.length} inscriptions (batch reveal)` : 'Inscription reveal')
    for (const [type, n] of countBy(inscriptions.map((i) => i.contentType ?? (i.delegate ? 'delegate' : 'no content type')))) {
        labels.push(n > 1 ? `${n}Ã— ${type}` : type)
    }
    for (const i of inscriptions) {
        if (i.protocol && i.protocol !== 'brc-20') labels.push(PROTOCOL_LABEL[i.protocol] ?? `Protocol: ${i.protocol}${i.op ? ` ${i.op}` : ''}`)
    }

    const any = (test) => inscriptions.some(test)
    if (any((i) => i.parents.length)) labels.push('Child inscription (has parent)')
    if (any((i) => i.delegate)) labels.push('Delegate inscription')
    if (any((i) => i.metaprotocol)) labels.push(`Metaprotocol: ${inscriptions.find((i) => i.metaprotocol).metaprotocol}`)
    const encoding = inscriptions.find((i) => i.contentEncoding)?.contentEncoding
    if (encoding) labels.push(`${encoding}-compressed body`)
    if (any((i) => i.metadataHex !== null)) labels.push('Has CBOR metadata')
    if (any((i) => i.properties !== null || i.propertiesHex !== null)) labels.push('Has properties')
    if (any((i) => i.gallery.length)) labels.push('Gallery')
    if (any((i) => i.pointer !== null)) labels.push('Uses pointer')
    if (any((i) => i.unbound)) labels.push('Unbound (tag 66)')
    if (any((i) => !i.complete)) labels.push('Incomplete envelope (no OP_ENDIF)')

    // An unknown even tag, a repeated tag or pushnum data makes ord treat an inscription as cursed.
    const unknownEvenTag = (i) => i.unknownFields.some((field) => typeof field.tag === 'number' && field.tag % 2 === 0)
    if (any((i) => unknownEvenTag(i) || i.duplicateTags.length || i.pushnum)) labels.push('Cursed / unrecognised fields')
}

function labelAtomicals({ tx, labels, info, setKind }) {
    const atomicals = tx.inputs.flatMap((input) => input.witness?.atomicals ?? [])
    if (!atomicals.length) return
    const label = `Atomicals ${[...new Set(atomicals.map((a) => a.op))].join(', ')}`
    labels.push(label)
    setKind('atomicals', label)
    info.atomicals = atomicals
}

// The first output starting OP_RETURN OP_13 is the runestone (even if malformed). Other OP_RETURNs
// are matched against known protocols.
function labelOpReturns(ctx) {
    const { tx, labels, info, setKind, carriers } = ctx
    const runestoneIndex = tx.outputs.findIndex(isRunestoneOutput)
    const runestone = runestoneIndex === -1 ? null : runestoneOf(tx)

    for (const { index, data } of carriers) {
        if (runestone && index === runestoneIndex) { labelRunestone(ctx, runestone); continue }
        if (tx.isCoinbase) continue   // coinbase commitments are described by labelCoinbase

        const described = describeOpReturn(data)
        ;(info.opReturns ??= []).push(described)
        labels.push(described.label)
        if (data.length > 83) labels.push(`Large OP_RETURN (${data.length} B)`)
        if (data.length) setKind('opreturn', described.label)
    }
}

function labelRunestone({ tx, height, runeInfo, labels, info, setKind }, runestone) {
    info.runestone = runestone

    // An etching names its own rune. Mints and edicts refer to a rune id (0:0 = etched in this tx).
    const etched = describeEtching(runestone, tx.index, height)
    const runeFor = (id) => (id === '0:0' ? etched : runeInfo.get(id) ?? null)
    if (runestone.mint) runestone.mintRune = runeFor(runestone.mint)
    for (const edict of runestone.edicts) edict.rune = runeFor(edict.id)

    const summary = []
    if (runestone.cenotaph) summary.push(`Cenotaph (burns runes: ${runestone.cenotaphReasons[0]})`)
    if (runestone.etching) {
        const e = runestone.etching
        summary.push(`Rune etching ${e.name ?? '(reserved name)'}${e.symbol ? ` ${e.symbol}` : ''}`)
    }
    if (runestone.mint) summary.push(runestone.mintRune ? `Rune mint ${runestone.mintRune.name} (${runestone.mint})` : `Rune mint ${runestone.mint}`)
    if (runestone.edicts.length) {
        const names = [...new Set(runestone.edicts.map((edict) => edict.rune?.name ?? edict.id))]
        const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '')
        summary.push(`Rune transfer ${shown} (${plural(runestone.edicts.length, 'edict')})`)
    }
    setKind('rune', summary[0] ?? 'Runestone')
    labels.push(...summary)

    // The first few edicts spelled out.
    for (const edict of runestone.edicts.slice(0, 3)) {
        const amount = edict.amount === 0n ? 'all' : formatRuneAmount(edict.amount, edict.rune?.divisibility ?? 0)
        const where = edict.output === tx.outputs.length ? 'every output' : `output ${edict.output}`
        labels.push(`Transfer ${amount} ${edict.rune?.name ?? edict.id} to ${where}`)
    }
    if (runestone.edicts.length > 3) labels.push(`+${runestone.edicts.length - 3} more edicts`)

    const e = runestone.etching
    if (e) {
        if (e.premine) labels.push(`Premine ${formatRuneAmount(e.premine, e.divisibility)}`)
        if (e.terms?.cap != null) labels.push(`Open mint: cap ${e.terms.cap} Ã— ${formatRuneAmount(e.terms.amount ?? 0n, e.divisibility)}`)
        if (e.turbo) labels.push('Turbo')
    }
    if (runestone.protostone) labels.push('Protostone (Alkanes / protorunes)')
    if (!e && !runestone.mint && !runestone.edicts.length && !runestone.cenotaph) labels.push('Runestone (pointer / no-op)')
}

function labelCounterparty({ tx, labels, info, setKind, carriers }) {
    if (tx.isCoinbase || !(carriers.length || tx.outputs.some((o) => o.scriptType === 'multisig'))) return
    const counterparty = decodeCounterparty(tx, carriers)
    if (!counterparty) return

    if (counterparty.unknown) {
        setKind('stamp', 'Data in bare multisig (Stamps-style)')
        labels.push('Data in bare multisig (Stamps-style)')
        return
    }
    info.counterparty = counterparty
    const label = counterparty.stamp ? 'Bitcoin Stamp' : `Counterparty ${counterparty.type}`
    setKind('stamp', label)
    labels.push(label)
    if (counterparty.src20) labels.push('SRC-20')
    labels.push(`Data in ${counterparty.encoding}`)
}

function labelInputs({ tx, labels, kind, setKind }) {
    if (tx.isCoinbase) return
    const spends = tx.inputs.map((input) => input.spend)
    const names = spends.map((s) => (s.multisig ? `${SPEND_LABEL[s.type]} ${s.multisig} multisig` : SPEND_LABEL[s.type] ?? s.type))
    for (const [name, n] of countBy(names)) labels.push(`${n > 1 ? `${n}Ã— ` : ''}${name} input`)

    const sighashes = spends.map((s) => s.sighash).filter((s) => s !== null && s !== 1)
    if (sighashes.includes(0x83)) {
        labels.push('SIGHASH_SINGLE|ANYONECANPAY (PSBT listing)')
        if (kind === 'payment' || kind === 'ordinal_transfer') setKind('market', 'Marketplace sale (PSBT)')
    } else if (sighashes.length) {
        labels.push(`Sighash ${[...new Set(sighashes.map((s) => SIGHASH_NAMES[s] ?? `0x${s.toString(16)}`))].join(', ')}`)
    }
    if (spends.some((s) => s.annex)) labels.push('Taproot annex')
    if (tx.inputs.some((i) => i.sequence < 0xfffffffe)) labels.push('Signals RBF')
}

function labelTimelocks({ tx, height, labels, setKind }) {
    if (tx.version === 3) labels.push('v3 (TRUC) transaction')
    else if (tx.version !== 1 && tx.version !== 2) labels.push(`Non-standard version ${tx.version}`)

    if (tx.locktime === 21 && !tx.isCoinbase) {
        labels.push('CAT-21 mint (nLockTime 21)')
        setKind('inscription', 'CAT-21 mint')
    } else if (tx.locktime > 0 && !tx.isCoinbase) {
        if (tx.locktime >>> 24 === 0x20 && tx.inputs.some((i) => i.sequence >>> 24 === 0x80)) {
            labels.push('Lightning commitment (force close)')
            setKind('lightning', 'Lightning force close')
        } else if (tx.locktime < 500_000_000) {
            labels.push(height && height - tx.locktime < 200 ? 'Anti fee-sniping locktime' : `Locktime: block ${tx.locktime}`)
        } else {
            labels.push(`Locktime: ${new Date(tx.locktime * 1000).toISOString().slice(0, 10)}`)
        }
    }

    const hasCsv = tx.inputs.some((i) => i.sequence < 0xf0000000 && !(i.sequence & 0x80000000) && i.sequence !== 0)
    if (tx.version >= 2 && hasCsv && !labels.some((l) => l.startsWith('Lightning'))) labels.push('Relative timelock (CSV)')
}

function labelLightning({ tx, labels, kind, setKind }) {
    if (tx.isCoinbase || kind !== 'payment') return
    if (tx.inputs.some((i) => i.spend.type === 'p2wsh' && i.spend.multisig === '2-of-2')) {
        setKind('lightning', 'Lightning channel close')
        labels.push('Lightning channel close (2-of-2 funding spend)')
    } else if (tx.inputs.some((i) => i.spend.htlc)) {
        setKind('lightning', 'Lightning HTLC sweep')
        labels.push('Lightning HTLC / timeout sweep')
    }
}

// Shape heuristics for plain payments, then ordinals-style transfers.
function labelShape(ctx) {
    const { tx, labels, setKind, inscriptions } = ctx
    if (tx.isCoinbase) return
    const inputCount = tx.inputs.length
    const outputCount = tx.outputs.length

    if (ctx.kind === 'payment') {
        const valueCounts = countBy(tx.outputs.filter((o) => o.scriptType !== 'op_return').map((o) => o.value))
        let [equalValue, equalCount] = [0, 0]
        for (const [v, n] of valueCounts) if (n > equalCount && v > 10_000) [equalValue, equalCount] = [v, n]

        let label
        if (inputCount === 5 && outputCount === 5 && equalCount === 5 && COINJOIN_POOLS.has(equalValue)) {
            label = `Whirlpool CoinJoin (${equalValue / 1e8} BTC pool)`
            setKind('coinjoin', label)
        } else if (equalCount >= 5 && inputCount >= 5 && equalCount >= outputCount / 3) {
            label = `CoinJoin: ${equalCount} equal outputs of ${equalValue / 1e8} BTC${inputCount >= 50 ? ' (WabiSabi-like)' : ''}`
            setKind('coinjoin', label)
        } else if (inputCount >= 10 && outputCount <= 2) {
            label = `Consolidation ${inputCount} â†’ ${outputCount}`
            setKind('consolidation', label)
        } else if (outputCount >= 10) {
            label = `Batch payment to ${outputCount} outputs`
            setKind('batch', label)
        }
        if (label) labels.push(label)
    }

    // Taproot in, a postage-sized taproot out and no envelope: likely an inscription or rune moving.
    if ((ctx.kind === 'payment' || ctx.kind === 'market') && !inscriptions.length) {
        const hasPostage = tx.outputs.some((o) => o.scriptType === 'p2tr' && POSTAGE.has(o.value))
        const hasTaprootInput = tx.inputs.some((i) => i.spend.type.startsWith('p2tr'))
        if (hasPostage && hasTaprootInput) {
            if (ctx.kind === 'payment') setKind('ordinal_transfer', 'Likely inscription / rune transfer')
            labels.push('Postage-sized taproot output (likely inscription/rune transfer)')
        }
    }
}

function labelOutputs(ctx) {
    const { tx, labels } = ctx
    for (const [type, n] of countBy(tx.outputs.map((o) => o.scriptType))) {
        labels.push(`${n > 1 ? `${n}Ã— ` : ''}${OUTPUT_LABEL[type] ?? type} output`)
    }
    if (tx.outputs.some((o) => o.scriptType === 'p2a')) labels.push('Ephemeral anchor (P2A)')

    const dust = tx.outputs.filter((o) => o.scriptType !== 'op_return' && o.value > 0 && o.value < 1000).length
    if (dust) labels.push(plural(dust, 'dust-sized output'))

    if (!tx.isCoinbase && ctx.kind === 'payment' && tx.inputs.length === 1 && tx.outputs.length <= 2) {
        labels.push(tx.outputs.length === 2 ? 'Simple payment with change (likely)' : 'Single-output sweep / payment')
    }
}

const countBy = (list) => {
    const counts = new Map()
    for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1)
    return counts
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function bigIntsToStrings(value) {
    if (typeof value === 'bigint') return value.toString()
    if (Array.isArray(value)) return value.map(bigIntsToStrings)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bigIntsToStrings(v)]))
    return value
}

/* ---------------------------- inscription media ---------------------------- */

export function mediaCategory(contentType) {
    const type = (contentType ?? '').toLowerCase().split(';')[0].trim()
    if (!type) return 'none'
    if (type === 'image/svg+xml') return 'svg'
    if (type.startsWith('image/')) return 'image'
    if (type.startsWith('model/') || type === 'application/sla') return 'model'
    if (type.startsWith('audio/')) return 'audio'
    if (type.startsWith('video/')) return 'video'
    if (type === 'text/html') return 'html'
    if (type === 'application/pdf') return 'pdf'
    if (type.startsWith('font/') || type.includes('font-')) return 'font'
    if (type.includes('javascript') || type === 'text/ecmascript') return 'js'
    if (type === 'text/css') return 'css'
    if (type === 'application/json' || type.endsWith('+json') || type === 'application/yaml') return 'json'
    if (type.startsWith('text/')) return 'text'
    return 'binary'
}

// Adds `media`, and for small text bodies the protocol they follow (BRC-20, bitmap, .sats, ...).
function describeInscription(inscription) {
    inscription.media = inscription.bodyLength === 0 && inscription.delegate ? 'delegate' : mediaCategory(inscription.contentType)
    inscription.protocol = null
    inscription.op = null
    inscription.tick = null
    inscription.amount = null

    // Bodies are not decompressed here, so an encoded body is not readable text.
    const isText = inscription.contentType && /^(text\/|application\/json)/i.test(inscription.contentType)
    if (!isText || inscription.contentEncoding || inscription.text === null || inscription.bodyLength > 8192) return

    const text = inscription.text.trim()
    if (text.startsWith('{')) {
        try {
            const json = JSON.parse(text)
            if (json && typeof json.p === 'string') {
                inscription.protocol = json.p.toLowerCase()
                inscription.op = typeof json.op === 'string' ? json.op.toLowerCase() : null
                inscription.tick = json.tick ?? json.name ?? null
                inscription.amount = json.amt ?? json.max ?? null
            }
        } catch { /* not JSON */ }
    }
    if (/^\d+\.bitmap$/.test(text)) inscription.protocol = 'bitmap'
    else if (/^[^\s.]+\.sats$/i.test(text)) inscription.protocol = 'sats-name'
    else if (/^[^\s.]+\.[a-z0-9]{2,12}$/i.test(text) && text.length < 64 && /text\/plain/i.test(inscription.contentType)) inscription.protocol ??= 'name'
}

// Lower case coinbase text -> pool name, first match wins. A third value of true means the
// needle must be a whole word ("solo" must not match "console").
const POOL_TAGS = [
    ['foundry', 'Foundry USA'], ['antpool', 'AntPool'], ['viabtc', 'ViaBTC'], ['f2pool', 'F2Pool'], ['ðŸŸ', 'F2Pool'],
    ['spiderpool', 'SpiderPool'], ['mara', 'MARA Pool'], ['luxor', 'Luxor'], ['secpool', 'SECPOOL'],
    ['binance', 'Binance Pool'], ['ocean', 'OCEAN', true], ['/slush/', 'Braiins Pool'], ['braiins', 'Braiins Pool'],
    ['sbicrypto', 'SBI Crypto'], ['sbi crypto', 'SBI Crypto'], ['poolin', 'Poolin'], ['btc.com', 'BTC.com'],
    ['ultimus', 'ULTIMUSPOOL'], ['whitepool', 'WhitePool'], ['emcd', 'EMCD'], ['carbon negative', 'Carbon Negative'],
    ['bitfufu', 'BitFuFu'], ['mining-dutch', 'Mining-Dutch'], ['kucoin', 'KuCoin Pool'], ['okx', 'OKX', true], ['okex', 'OKX', true],
    ['huobi', 'Huobi Pool'], ['btc.top', 'BTC.TOP'], ['1thash', '1THash'], ['bitdeer', 'Bitdeer'], ['titan', 'Titan', true],
    ['public-pool', 'Public Pool'], ['ckpool', 'CKPool (solo)'], ['solo', 'Solo miner', true], ['datum', 'DATUM', true],
    ['innopolis', 'Innopolis Tech'], ['gbminers', 'GBMiners'], ['bitfury', 'BitFury'], ['bw pool', 'BW Pool'],
    ['ghash', 'GHash.IO'], ['eligius', 'Eligius'], ['btcguild', 'BTC Guild'], ['50btc', '50BTC'], ['kano', 'KanoPool', true],
]

const isWordChar = (char) => char !== undefined && /[a-z0-9]/.test(char)

function findPool(lowerText) {
    for (const [needle, name, wholeWord] of POOL_TAGS) {
        for (let from = 0; ;) {
            const at = lowerText.indexOf(needle, from)
            if (at === -1) break
            if (!wholeWord || (!isWordChar(lowerText[at - 1]) && !isWordChar(lowerText[at + needle.length]))) return name
            from = at + 1
        }
    }
    return null
}

// Known OP_RETURN prefixes in coinbase outputs (null name = ignore).
const COINBASE_OP_RETURNS = [
    [[0xaa, 0x21, 0xa9, 0xed], 'SegWit witness commitment'],
    [[...ascii('RSKBLOCK:')], 'Rootstock merge-mining'],
    [[...ascii('CORE')], 'Core DAO delegation'],
    [[...ascii('Hath')], 'Hathor merge-mining'],
    [[0, 0, 0, 0], null],
    [[0xb9, 0xe1, 0x1b, 0x6d], 'Syscoin merge-mining'],
    [[...ascii('stx')], 'Stacks'],
    [[...ascii('ExSat')], 'exSat'],
]

export function decodeCoinbase(tx) {
    const scriptSig = fromHex(tx.inputs[0].scriptSig)

    // BIP34: the first push of the coinbase script is the block height.
    const heightPush = readScript(scriptSig)[0]?.data
    const bip34Height = heightPush && heightPush.length && heightPush.length <= 4 ? littleEndian(heightPush) : null

    // Pools sign the coinbase with readable text. The raw text is searched too (F2Pool's fish is not ASCII).
    const text = printableRuns(scriptSig).join(' ').trim()
    const pool = findPool(`${text} ${toText(scriptSig)}`.toLowerCase())

    const extras = []
    for (const output of tx.outputs) {
        if (output.scriptType !== 'op_return') continue
        const data = readScript(fromHex(output.script).subarray(1))[0]?.data
        const match = data && COINBASE_OP_RETURNS.find(([prefix]) => startsWithBytes(data, prefix))
        if (match?.[1]) extras.push(match[1])
    }
    return { bip34Height, tag: text.slice(0, 120), pool, extras: [...new Set(extras)] }
}

function printableRuns(bytes, minLength = 4) {
    const runs = []
    let current = ''
    for (const byte of bytes) {
        if (byte >= 0x20 && byte < 0x7f) {
            current += String.fromCharCode(byte)
        } else {
            if (current.length >= minLength) runs.push(current)
            current = ''
        }
    }
    if (current.length >= minLength) runs.push(current)
    return runs
}

/*
 * A runestone is OP_RETURN OP_13 <pushes>. The joined pushes are LEB128 integers: tag/value pairs,
 * then (after tag 0) edicts in groups of four. Spec: https://docs.ordinals.com/runes/specification.html
 */
const RUNE_TAG = {
    BODY: 0n, FLAGS: 2n, RUNE: 4n, PREMINE: 6n, CAP: 8n, AMOUNT: 10n, HEIGHT_START: 12n, HEIGHT_END: 14n,
    OFFSET_START: 16n, OFFSET_END: 18n, MINT: 20n, POINTER: 22n, CENOTAPH: 126n,
    DIVISIBILITY: 1n, SPACERS: 3n, SYMBOL: 5n, NOP: 127n,
}
const PROTOSTONE_TAG = 16383n   // Alkanes / protorunes

function readLeb128List(bytes) {
    const ints = []
    let i = 0
    while (i < bytes.length) {
        let n = 0n
        let shift = 0n
        for (;;) {
            if (i >= bytes.length) return { ints, truncated: true }
            const byte = bytes[i++]
            n |= BigInt(byte & 0x7f) << shift
            if (!(byte & 0x80)) break
            shift += 7n
            if (shift > 126n) return { ints, overflow: true }
        }
        ints.push(n)
    }
    return { ints }
}

// Base 26 (A = 1 ... Z = 26, AA = 27 ...) with optional "â€¢" spacers.
export function runeName(n, spacers = 0n) {
    let x = n + 1n
    let name = ''
    while (x > 0n) {
        name = String.fromCharCode(65 + Number((x - 1n) % 26n)) + name
        x = (x - 1n) / 26n
    }
    if (!spacers) return name
    let spaced = ''
    for (let i = 0; i < name.length; i++) {
        spaced += name[i]
        if (spacers & (1n << BigInt(i))) spaced += 'â€¢'
    }
    return spaced
}

export function formatRuneAmount(amount, divisibility = 0) {
    if (!divisibility) return amount.toString()
    const digits = amount.toString().padStart(divisibility + 1, '0')
    return `${digits.slice(0, -divisibility)}.${digits.slice(-divisibility)}`.replace(/\.?0+$/, '')
}

// Decoded runestone, or null if the script is not one. outputCount catches out-of-range pointers/edicts.
export function decodeRunestone(script, outputCount = Infinity) {
    script = toBytes(script)
    if (script.length < 2 || script[0] !== 0x6a || script[1] !== 0x5d) return null   // OP_RETURN OP_13

    // These problems void the whole message: a cenotaph with no etching, mint or edicts.
    // Only opcodes 0 to 78 are data pushes, so OP_1NEGATE and OP_1..OP_16 count as errors.
    const fatal = []
    const chunks = []
    for (const op of readScript(script.subarray(2))) {
        if (op.data === null || op.isNumber) fatal.push('opcode in payload')
        else chunks.push(op.data)
    }
    const { ints, truncated, overflow } = readLeb128List(concat(chunks))
    if (truncated) fatal.push('truncated varint')
    if (overflow) fatal.push('varint overflow')
    if (fatal.length) return { cenotaph: true, cenotaphReasons: [...new Set(fatal)], edicts: [], pointer: null, protostone: false }

    // Other problems also make a cenotaph (runes are burned) but the content is still readable.
    const cenotaphReasons = []
    const fields = new Map()   // tag -> values
    const edicts = []
    for (let i = 0; i < ints.length;) {
        const tag = ints[i]
        if (tag === RUNE_TAG.BODY) {
            // Edicts: block, tx, amount, output. Ids are delta encoded.
            let block = 0n
            let txIndex = 0n
            const rest = ints.slice(i + 1)
            if (rest.length % 4) cenotaphReasons.push('trailing edict integers')
            for (let k = 0; k + 3 < rest.length; k += 4) {
                block += rest[k]
                txIndex = rest[k] === 0n ? txIndex + rest[k + 1] : rest[k + 1]
                const edict = { id: `${block}:${txIndex}`, amount: rest[k + 2], output: Number(rest[k + 3]) }
                edicts.push(edict)
                if (edict.output > outputCount) cenotaphReasons.push('edict output out of range')
                if (block === 0n && txIndex > 0n) cenotaphReasons.push('invalid rune id (block 0)')
            }
            break
        }
        if (i + 1 >= ints.length) { cenotaphReasons.push('tag without value'); break }
        if (!fields.has(tag)) fields.set(tag, [])
        fields.get(tag).push(ints[i + 1])
        i += 2
    }

    const first = (tag) => fields.get(tag)?.[0]
    const flags = first(RUNE_TAG.FLAGS) ?? 0n
    const known = Object.values(RUNE_TAG)
    for (const tag of fields.keys()) {
        if (tag % 2n === 0n && !known.includes(tag) && tag !== PROTOSTONE_TAG) cenotaphReasons.push(`unknown even tag ${tag}`)
    }
    if (flags > 7n) cenotaphReasons.push('unknown flags')

    const pointer = first(RUNE_TAG.POINTER) !== undefined ? Number(first(RUNE_TAG.POINTER)) : null
    if (pointer !== null && pointer >= outputCount) cenotaphReasons.push('pointer out of range')

    const result = {
        cenotaph: cenotaphReasons.length > 0,
        cenotaphReasons: [...new Set(cenotaphReasons)],
        edicts,
        pointer,
        protostone: fields.has(PROTOSTONE_TAG),
    }

    const mint = fields.get(RUNE_TAG.MINT)
    if (mint?.length >= 2) result.mint = `${mint[0]}:${mint[1]}`

    if ((flags & 1n) === 1n) {   // etching
        const rune = first(RUNE_TAG.RUNE)
        const symbol = first(RUNE_TAG.SYMBOL)
        result.etching = {
            name: rune !== undefined ? runeName(rune, first(RUNE_TAG.SPACERS) ?? 0n) : null,   // null: reserved name
            divisibility: Number(first(RUNE_TAG.DIVISIBILITY) ?? 0n),
            symbol: symbol !== undefined && symbol <= 0x10ffffn ? String.fromCodePoint(Number(symbol)) : null,
            premine: first(RUNE_TAG.PREMINE) ?? 0n,
            turbo: (flags & 4n) === 4n,
            terms: (flags & 2n) === 2n
                ? {
                    cap: first(RUNE_TAG.CAP) ?? null,
                    amount: first(RUNE_TAG.AMOUNT) ?? null,
                    heightStart: first(RUNE_TAG.HEIGHT_START) ?? null,
                    heightEnd: first(RUNE_TAG.HEIGHT_END) ?? null,
                    offsetStart: first(RUNE_TAG.OFFSET_START) ?? null,
                    offsetEnd: first(RUNE_TAG.OFFSET_END) ?? null,
                }
                : null,
        }
    }
    return result
}

// An etching without a name gets a reserved one, derived from its position in the chain.
const RESERVED_RUNE = 6402364363415443603228541259936211926n   // the name AAAAAAAAAAAAAAAAAAAAAAAAAAA
const reservedRuneName = (height, txIndex) => runeName(RESERVED_RUNE + ((BigInt(height) << 32n) | BigInt(txIndex)))

// UNCOMMONâ€¢GOODS is built into the protocol (id 1:0), there is no etching transaction to read.
const GENESIS_RUNE = { id: '1:0', name: 'UNCOMMONâ€¢GOODS', symbol: 'â§‰', divisibility: 0 }

// The rune a transaction etches ({ id, name, symbol, divisibility }), or null.
function describeEtching(runestone, txIndex, height) {
    const etching = runestone.etching
    if (!etching) return null
    if (etching.name === null && height !== null) {
        etching.name = reservedRuneName(height, txIndex)
        etching.reserved = true
    }
    etching.id = height === null ? null : `${height}:${txIndex}`
    return { id: etching.id, name: etching.name, symbol: etching.symbol, divisibility: etching.divisibility }
}

const isRunestoneOutput = (output) => output.scriptType === 'op_return' && output.script.startsWith('6a5d')

const runestones = new WeakMap()   // decode each transaction's runestone once

function runestoneOf(tx) {
    if (runestones.has(tx)) return runestones.get(tx)
    const output = tx.outputs.find(isRunestoneOutput)
    const runestone = output ? decodeRunestone(fromHex(output.script), tx.outputs.length) : null
    runestones.set(tx, runestone)
    return runestone
}

// Finds the name of every rune id the block mentions: Map(id -> { id, name, symbol, divisibility } | null)
async function resolveRunes(block, option) {
    const found = new Map()
    const wanted = new Set()
    for (const tx of block.txs) {
        const runestone = runestoneOf(tx)
        if (!runestone) continue
        if (runestone.mint) wanted.add(runestone.mint)
        for (const edict of runestone.edicts) wanted.add(edict.id)
    }
    wanted.delete('0:0')   // etched in the transaction itself
    if (wanted.size === 0) return found

    // Etching blocks other than this one. Only the outputs matter, so skip the rest.
    const cheap = { classify: false, locate: false }
    const getBlock = typeof option === 'function' ? option : option === true ? (height) => fetchBlock(height, cheap) : null
    const heights = [...new Set([...wanted].map((id) => Number(id.split(':')[0])))].filter((h) => h !== block.height && h !== 1)
    const others = new Map()
    if (getBlock) {
        let next = 0
        const worker = async () => {
            while (next < heights.length) {
                const height = heights[next++]
                try { others.set(height, await getBlock(height)) } catch { others.set(height, null) }
            }
        }
        await Promise.all(Array.from({ length: Math.min(4, heights.length) }, worker))
    }

    for (const id of wanted) {
        if (id === GENESIS_RUNE.id) { found.set(id, GENESIS_RUNE); continue }
        const [height, txIndex] = id.split(':').map(Number)
        const etchingTx = (height === block.height ? block : others.get(height))?.txs[txIndex]
        const runestone = etchingTx ? runestoneOf(etchingTx) : null
        found.set(id, runestone ? describeEtching(runestone, txIndex, height) : null)
    }
    return found
}

// Data pushed after OP_RETURN, joined (a lone OP_1..OP_16 is not data).
function opReturnPayload(script) {
    const pushes = readScript(script.subarray(1)).filter((op) => op.data && op.data.length && !(op.data.length === 1 && op.opcode >= 0x51))
    return pushes.length === 1 ? pushes[0].data : concat(pushes.map((op) => op.data))
}

// [prefix, name, optional describer]. "(likely)" where the prefix alone is not conclusive.
const OP_RETURN_PREFIXES = [
    ['omni', 'omni', describeOmni],
    ['bbn1', 'Babylon staking'],
    ['CORE', 'Core DAO'],
    ['X2', 'Stacks (likely)'],
    ['id', 'Stacks / Blockstack (likely)'],
    ['EXSAT', 'exSat'],
    ['SPK', 'SPK / Spark (likely)'],
    ['=:', 'THORChain swap memo'],
    ['SWAP:', 'THORChain swap memo'],
    ['OUT:', 'THORChain outbound'],
    ['REFUND:', 'THORChain refund'],
    ['ADD:', 'THORChain add liquidity'],
    ['ord', 'Ordinals data'],
    ['DOCPROOF', 'Proof of Existence'],
    ['OA', 'Open Assets (likely)'],
    ['EW', 'Eternity Wall'],
    ['FACTOM', 'Factom anchor'],
    ['BITPROOF', 'Bitproof timestamp'],
    ['Hath', 'Hathor'],
    ['RSKBLOCK:', 'Rootstock'],
]

export function describeOpReturn(data) {
    if (!data.length) return { protocol: null, label: 'Empty OP_RETURN' }
    for (const [prefix, name, describe] of OP_RETURN_PREFIXES) {
        if (startsWithBytes(data, [...ascii(prefix)])) {
            return describe ? { protocol: name, ...describe(data.subarray(prefix.length)) } : { protocol: name, label: name }
        }
    }
    if (data.length === 32) return { protocol: null, label: 'OP_RETURN 32-byte hash (timestamp / anchor)' }
    if (data.length === 20) return { protocol: null, label: 'OP_RETURN 20-byte hash' }
    const text = printableText(data)
    if (text) return { protocol: 'text', label: 'OP_RETURN text', text: text.slice(0, 160) }
    return { protocol: null, label: `OP_RETURN data (${data.length} B)` }
}

const OMNI_PROPERTIES = { 1: 'OMNI', 2: 'TOMNI', 3: 'MaidSafeCoin', 31: 'USDT' }
const OMNI_TYPES = { 0: 'simple send', 3: 'send to owners', 4: 'send all', 20: 'DEx sell offer', 50: 'create property', 51: 'crowdsale', 54: 'managed property', 55: 'grant', 56: 'revoke', 185: 'freeze', 186: 'unfreeze' }

// After "omni": version (u16), type (u16), then type specific fields, big endian.
function describeOmni(data) {
    if (data.length < 4) return { label: 'Omni Layer' }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const type = view.getUint16(2)
    const result = { label: `Omni ${OMNI_TYPES[type] ?? `type ${type}`}` }
    if (type === 0 && data.length >= 16) {
        const property = view.getUint32(4)
        const amount = view.getBigUint64(8)
        const divisible = property === 1 || property === 2 || property === 31
        const [whole, fraction] = (divisible ? String(Number(amount) / 1e8) : String(amount)).split('.')
        result.label = `Omni send ${whole.replace(/\B(?=(\d{3})+$)/g, ',')}${fraction ? `.${fraction}` : ''} ${OMNI_PROPERTIES[property] ?? `property ${property}`}`
    }
    return result
}

// Counterparty messages are ARC4 encrypted, keyed with the first input's txid.
function arc4(key, data) {
    const state = new Uint8Array(256)
    for (let i = 0; i < 256; i++) state[i] = i
    for (let i = 0, j = 0; i < 256; i++) {
        j = (j + state[i] + key[i % key.length]) & 255
        ;[state[i], state[j]] = [state[j], state[i]]
    }
    const out = new Uint8Array(data.length)
    for (let k = 0, i = 0, j = 0; k < data.length; k++) {
        i = (i + 1) & 255
        j = (j + state[i]) & 255
        ;[state[i], state[j]] = [state[j], state[i]]
        out[k] = data[k] ^ state[(state[i] + state[j]) & 255]
    }
    return out
}

const COUNTERPARTY_PREFIX = [...ascii('CNTRPRTY')]
const COUNTERPARTY_TYPES = {
    0: 'send', 1: 'enhanced send', 2: 'enhanced send', 3: 'MPMA send', 4: 'sweep', 10: 'order', 11: 'BTC pay',
    12: 'dispenser', 13: 'dispense', 20: 'issuance', 21: 'issuance', 22: 'subasset issuance', 23: 'subasset issuance',
    30: 'broadcast', 40: 'bet', 50: 'dividend', 60: 'burn', 70: 'cancel', 80: 'rock-paper-scissors',
    90: 'fairminter', 91: 'fairmint', 100: 'UTXO attach', 101: 'UTXO detach', 102: 'UTXO move', 110: 'destroy',
}

// After "CNTRPRTY": new format has a 1 byte type id, old format a 4 byte big endian id.
function parseCounterpartyMessage(message) {
    let typeId = message[0]
    let body = message.subarray(1)
    if (typeId === 0 && message.length >= 4 && (message[1] | message[2]) === 0) {
        typeId = (message[0] << 24) | (message[1] << 16) | (message[2] << 8) | message[3]
        body = message.subarray(4)
    }
    const text = toText(body)
    return {
        type: COUNTERPARTY_TYPES[typeId] ?? `type ${typeId}`,
        stamp: /stamp:/i.test(text),
        src20: /"p"\s*:\s*"src-20"/i.test(text),
    }
}

// Counterparty data in an OP_RETURN, or hidden in bare multisig keys (how Bitcoin Stamps works).
function decodeCounterparty(tx, carriers) {
    const key = fromHex(tx.inputs[0].txid)

    for (const { data } of carriers) {
        if (data.length < 8) continue
        const decrypted = arc4(key, data)
        if (startsWithBytes(decrypted, COUNTERPARTY_PREFIX)) return { encoding: 'OP_RETURN', ...parseCounterpartyMessage(decrypted.subarray(8)) }
    }

    const multisigs = tx.outputs.filter((o) => o.scriptType === 'multisig')
    if (!multisigs.length) return null

    const chunks = []
    for (const output of multisigs) {
        const multisig = multisigInfo(fromHex(output.script))
        if (!multisig) continue
        // Every key except the last carries 31 bytes of data between its first and last byte.
        const data = concat(multisig.keys.slice(0, -1).map((k) => k.subarray(1, k.length - 1)))
        const decrypted = arc4(key, data)
        const payload = decrypted.subarray(1, 1 + decrypted[0])
        if (startsWithBytes(payload, COUNTERPARTY_PREFIX)) chunks.push(payload.subarray(8))
    }
    if (!chunks.length) return { encoding: 'bare multisig', type: 'data', unknown: true }
    return { encoding: 'bare multisig', ...parseCounterpartyMessage(concat(chunks)) }
}

// CBOR stuff
//
// Byte strings become "0x..." hex, tags are skipped, integers beyond 2^53 become decimal strings.
// Anything malformed throws and tryDecodeCbor turns that into null.
const CBOR_MAX_DEPTH = 64

export function decodeCbor(bytes) {
    bytes = toBytes(bytes)
    let pos = 0

    const take = (length) => {
        if (pos + length > bytes.length) throw new Error('CBOR ended early')
        const out = bytes.subarray(pos, pos + length)
        pos += length
        return out
    }
    const view = (length) => {
        const part = take(length)
        return new DataView(part.buffer, part.byteOffset, length)
    }

    // The number after the first byte: a count, a length or the value itself (BigInt past 2^53).
    const readArgument = (info) => {
        if (info < 24) return info
        if (info === 24) return take(1)[0]
        if (info === 25) return view(2).getUint16(0)
        if (info === 26) return view(4).getUint32(0)
        if (info === 27) {
            const big = view(8).getBigUint64(0)
            return big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big
        }
        throw new Error('unsupported CBOR length')
    }

    // A length cannot exceed what is left (every item takes at least a byte).
    const toLength = (n) => {
        if (typeof n === 'bigint' || n > bytes.length - pos) throw new Error('CBOR length too large')
        return n
    }

    const isBreak = () => bytes[pos] === 0xff

    // Plain assignment to "__proto__" would change the prototype instead of adding a key.
    const setKey = (map, key, value) => {
        if (key === '__proto__') Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true })
        else map[key] = value
    }

    const readSimple = (info) => {
        if (info === 20) return false
        if (info === 21) return true
        if (info === 22 || info === 23) return null
        if (info === 25) return halfFloat(view(2).getUint16(0))
        if (info === 26) return view(4).getFloat32(0)
        if (info === 27) return view(8).getFloat64(0)
        if (info < 20) return null                  // unassigned simple value
        if (info === 24) { take(1); return null }   // simple value in the next byte
        throw new Error('unsupported CBOR value')
    }

    // An indefinite string is a series of normal strings of the same type, ended by a break.
    const readChunkedString = (type) => {
        const chunks = []
        while (!isBreak()) {
            const first = take(1)[0]
            if (first >> 5 !== type || (first & 31) === 31) throw new Error('bad CBOR string chunk')
            chunks.push(take(toLength(readArgument(first & 31))))
        }
        pos++   // the break
        return concat(chunks)
    }

    const readMap = (depth, count) => {   // count is undefined for an indefinite map
        const map = {}
        for (let i = 0; count === undefined ? !isBreak() : i < count; i++) {
            const key = readItem(depth + 1)
            setKey(map, key, readItem(depth + 1))
        }
        if (count === undefined) pos++
        return map
    }

    const readList = (depth, count) => {
        const list = []
        for (let i = 0; count === undefined ? !isBreak() : i < count; i++) list.push(readItem(depth + 1))
        if (count === undefined) pos++
        return list
    }

    const readItem = (depth) => {
        if (depth > CBOR_MAX_DEPTH) throw new Error('CBOR nested too deeply')
        const first = take(1)[0]
        const type = first >> 5
        const info = first & 31

        if (type === 7) return readSimple(info)   // true / false / null / floats

        if (info === 31) {                         // indefinite length
            if (type === 2) return '0x' + toHex(readChunkedString(2))
            if (type === 3) return toText(readChunkedString(3))
            if (type === 4) return readList(depth)
            if (type === 5) return readMap(depth)
            throw new Error('unsupported CBOR length')
        }

        const n = readArgument(info)
        if (type === 0) return typeof n === 'bigint' ? n.toString() : n                 // unsigned integer
        if (type === 1) return typeof n === 'bigint' ? (-1n - n).toString() : -1 - n    // negative integer
        if (type === 6) return readItem(depth + 1)                                      // tag: keep its value

        const length = toLength(n)
        if (type === 2) return '0x' + toHex(take(length))   // byte string
        if (type === 3) return toText(take(length))              // text string
        if (type === 4) return readList(depth, length)
        return readMap(depth, length)
    }

    return readItem(0)
}

function halfFloat(bits) {
    const sign = bits & 0x8000 ? -1 : 1
    const exponent = (bits >> 10) & 31
    const fraction = bits & 1023
    if (exponent === 0) return sign * fraction * 2 ** -24
    if (exponent === 31) return fraction ? NaN : sign * Infinity
    return sign * (1 + fraction / 1024) * 2 ** (exponent - 15)
}

export function tryDecodeCbor(bytes) {
    try { return decodeCbor(bytes) } catch { return null }
}

class Reader {
    constructor(bytes) {
        this.bytes = bytes
        this.pos = 0
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }

    read(length) {
        if (this.pos + length > this.bytes.length) throw new Error(`Block data ended early at byte ${this.pos}`)
        const out = this.bytes.subarray(this.pos, this.pos + length)   // a view, not a copy
        this.pos += length
        return out
    }

    uint32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v }
    int32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v }

    uint64() {
        const low = this.view.getUint32(this.pos, true)
        const high = this.view.getUint32(this.pos + 4, true)
        this.pos += 8
        return high * 2 ** 32 + low   // safe: all bitcoin in existence is far below 2^53 sats
    }

    varint() {
        const first = this.bytes[this.pos++]
        if (first < 0xfd) return first
        if (first === 0xfd) { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v }
        if (first === 0xfe) return this.uint32()
        return this.uint64()
    }
}

// Hex digits of every byte value as ASCII codes: entries byte*2 and byte*2+1 of this table.
const HEX_CODES = new Uint8Array(512)
for (let byte = 0; byte < 256; byte++) {
    const text = byte.toString(16).padStart(2, '0')
    HEX_CODES[byte * 2] = text.charCodeAt(0)
    HEX_CODES[byte * 2 + 1] = text.charCodeAt(1)
}
const asciiDecoder = new TextDecoder()
const hasNativeHex = typeof Uint8Array.fromHex === 'function' && typeof Uint8Array.prototype.toHex === 'function'

// Bytes -> hex. The codes are written into one array and turned into a string in one go, because
// appending to a string byte by byte makes millions of tiny strings that slow parsing down.
export function toHex(bytes) {
    if (hasNativeHex) return bytes.toHex()   // newer browsers do this natively
    const codes = new Uint8Array(bytes.length * 2)
    for (let i = 0; i < bytes.length; i++) {
        codes[i * 2] = HEX_CODES[bytes[i] * 2]
        codes[i * 2 + 1] = HEX_CODES[bytes[i] * 2 + 1]
    }
    return asciiDecoder.decode(codes)
}

// Value of each hex character code (-1 for anything that is not a hex digit).
const HEX_VALUES = new Int8Array(256).fill(-1)
for (let i = 0; i < 16; i++) {
    HEX_VALUES['0123456789abcdef'.charCodeAt(i)] = i
    HEX_VALUES['0123456789ABCDEF'.charCodeAt(i)] = i
}

// Hex (optionally 0x prefixed, spaces around are fine) -> bytes. Throws on bad hex.
export function fromHex(text) {
    const clean = text.trim().replace(/^0x/, '')
    if (clean.length % 2 !== 0) throw new Error('Not valid hex')
    if (hasNativeHex) {
        try { return Uint8Array.fromHex(clean) } catch { throw new Error('Not valid hex') }
    }
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        const high = HEX_VALUES[clean.charCodeAt(i * 2)]
        const low = HEX_VALUES[clean.charCodeAt(i * 2 + 1)]
        if (!(high >= 0 && low >= 0)) throw new Error('Not valid hex')   // also catches characters above 255
        bytes[i] = (high << 4) | low
    }
    return bytes
}

// Hex string or bytes -> bytes.
const toBytes = (input) => (typeof input === 'string' ? fromHex(input) : input)

// Bitcoin hashes are stored one way and shown byte-reversed.
export function reverseHex(bytes) {
    const length = bytes.length
    const codes = new Uint8Array(length * 2)
    for (let i = 0; i < length; i++) {
        const byte = bytes[length - 1 - i]
        codes[i * 2] = HEX_CODES[byte * 2]
        codes[i * 2 + 1] = HEX_CODES[byte * 2 + 1]
    }
    return asciiDecoder.decode(codes)
}

// Joins a list of byte arrays (a list, not spread arguments, so any length works).
export function concat(arrays) {
    const out = new Uint8Array(arrays.reduce((total, a) => total + a.length, 0))
    let offset = 0
    for (const a of arrays) { out.set(a, offset); offset += a.length }
    return out
}

function littleEndian(bytes) {
    let n = 0
    for (let i = bytes.length - 1; i >= 0; i--) n = n * 256 + bytes[i]
    return n
}

function littleEndianBig(bytes) {
    let n = 0n
    for (let i = bytes.length - 1; i >= 0; i--) n = n * 256n + BigInt(bytes[i])
    return n
}

function ascii(text) {
    return Uint8Array.from(text, (char) => char.charCodeAt(0))
}

const startsWithBytes = (bytes, prefix) => bytes.length >= prefix.length && prefix.every((value, i) => bytes[i] === value)
const equalsBytes = (bytes, expected) => bytes.length === expected.length && expected.every((value, i) => bytes[i] === value)

// Readable text if the bytes are mostly printable UTF-8, otherwise null.
function printableText(bytes, minRatio = 0.85) {
    if (!bytes.length) return null
    const text = toText(bytes)
    let printable = 0
    for (const char of text) {
        const code = char.codePointAt(0)
        if ((code >= 0x20 && code !== 0x7f && code !== 0xfffd) || code === 0x0a || code === 0x0d || code === 0x09) printable++
    }
    return printable / [...text].length >= minRatio ? text : null
}

const toText = (bytes) => new TextDecoder().decode(bytes)   // lenient: bad UTF-8 becomes replacement characters

function toTextOrNull(bytes) {   // strict: null unless valid UTF-8
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return null }
}
