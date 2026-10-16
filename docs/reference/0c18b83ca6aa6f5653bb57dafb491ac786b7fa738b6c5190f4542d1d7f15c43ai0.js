// liveOCI [alpha]: find the inscription id OR the sat of any bitmap, for example "969788.bitmap".
//
//   getBitmapInscriptionId(969123)  -get the inscription id of the bitmap
//   getBitmapSat(969123)  -get the sat that inscription is on
//
//   - bitmaps below 942000 come from the <942k OCI
//   - 942000 and up are found by iterating through the blocks themselves via /r/block
//
// rules:
//   1. the valid bitmap is the FIRST valid inscription, searching from the block with the same number onward.
//   2. "valid" means the content is exactly "969123.bitmap". No spaces, no hidden characters, nothing else.
//   3. Delegates are not allowed.
//   4. encoding (brotli/gzip) is not allowed.  if contentEncoding tag is present at all, invalid.

// experimental, there may be issues/edge case errors, always verify yourself - use at your own risk

// import old 942k oci:
import {
    getBitmapSat as indexSat,
    getBitmapInscriptionId as indexInscriptionId,
} from '/content/942b5886158d57fc70cb8fb7d9bd4d37aa95b8b145be1a351326336b087262dbi0'

// import block parser:
import { fetchBlock, listInscriptions, toHex } from '/content/bbbb2172ebca174579884df1ad7487196c39e860b3aacdf4e052a33bf5ec31fai0'

// ?origin= query param to set URL beginnings, like https://ordinals.com (for local testing).
const url = new URL(import.meta.url)
const params = new URLSearchParams(url.search)
const originParam = params.get('origin')

// The first bitmap number that is NOT in the on-chain index.
const OLD_OCI_LIMIT = 942000

// remember bitmaps the current module import has already found, so asking for the same bitmap again does not read the blocks again.
const foundCache = new Map()

// check that requested bitmap is in valid range (number, >= 0)
function checkBitmapNumber(bitmapNumber) {
    if (!Number.isInteger(bitmapNumber) || bitmapNumber < 0) {
        throw new Error('The bitmap number must be a whole number, 0 or higher')
    }
}

// Checks one inscription. Answers true if it is a valid claim for this bitmap number, otherwise false.
function isValidBitmap(inscription, bitmapNumber) {
    // The exact content a valid claim must have, for example "969123.bitmap".
    const expectedText = bitmapNumber + '.bitmap'

    // Turn that text into its raw bytes, written as hex, so we can compare the raw content exactly.
    const expectedHex = toHex(new TextEncoder().encode(expectedText))

    // The inscription's raw content must be exactly what we expect.
    if (inscription.bodyHex !== expectedHex) {
        return false
    }

    // The inscription must be fully written (its ending marker is present).
    if (inscription.complete !== true) {
        return false
    }

    // The content must not be compressed.
    if (inscription.contentEncoding) {
        return false
    }

    // no delegates at all
    if (inscription.delegate) {
        return false
    }

    // all good
    return true
}


// Reads the blocks to find the inscription of a bitmap. null if not claimed yet
async function findBitmapInBlocks(bitmapNumber) {
    // If we already found this owner before, use that.
    if (foundCache.has(bitmapNumber)) {
        return foundCache.get(bitmapNumber)
    }

    // A bitmap can only be claimed in the block with the same number, or any block after it.
    // So we start at that block.
    let blockNumber = bitmapNumber

    // Keep going, one block at a time, until we find an owner or run out of blocks.
    while (true) {
        // This will hold the block we download.
        let block = null

        try {
            // Download the block and read it. We skip extra work we don't need (classify and locate).
            block = await fetchBlock(blockNumber, { classify: false, locate: false })
        } catch (error) {
            // If the message says 404, that block does not exist yet. We reached the end of the chain
            // without finding a bitmap.
            if (error.message.includes('404')) {
                return null
            }

            // Any other problem (for example no internet) is a real error, so stop and report it.
            throw error
        }

        // Every inscription in this block, in the order they were created.
        const inscriptions = listInscriptions(block)

        // Check them one by one, earliest first.
        for (let i = 0; i < inscriptions.length; i++) {
            // If this one is a valid claim, it is the first, so it is the bitmap.
            if (isValidBitmap(inscriptions[i], bitmapNumber) === true) {
                foundCache.set(bitmapNumber, inscriptions[i])
                return inscriptions[i]
            }
        }

        // Nobody in this block owns it, so move on to the next block.
        blockNumber = blockNumber + 1
    }
}


// Gives the id of the inscription that owns the bitmap
export async function getBitmapInscriptionId(bitmapNumber) {
    // Make sure the number makes sense.
    checkBitmapNumber(bitmapNumber)

    // if less than 942k use oci
    if (bitmapNumber < OLD_OCI_LIMIT) {
        const indexedId = await indexInscriptionId(bitmapNumber)

        if (!indexedId) {
            throw new Error('The OCI has no inscription for ' + bitmapNumber + '.bitmap')
        }

        return indexedId
    }

    const bitmapInscription = await findBitmapInBlocks(bitmapNumber)

    if (bitmapInscription === null) {
        return null
    }

    return bitmapInscription.id
}


// Gives the sat that the bitmap's inscription is on
export async function getBitmapSat(bitmapNumber) {
    // Make sure the number makes sense.
    checkBitmapNumber(bitmapNumber)

    // <942k: the on-chain index already knows the sat.
    if (bitmapNumber < OLD_OCI_LIMIT) {
        const indexedSat = await indexSat(bitmapNumber)

        if (!indexedSat) {
            throw new Error('The on-chain index has no sat for ' + bitmapNumber + '.bitmap')
        }

        return indexedSat
    }

    // higher than 942k
    const id = await getBitmapInscriptionId(bitmapNumber)

    if (id === null) {
        return null
    }

    const response = await fetch((originParam || '') + '/r/inscription/' + id)

    if (!response.ok) {
        throw new Error('/r/inscription/' + id + ' returned HTTP ' + response.status)
    }

    const inscriptionInfo = await response.json()

    if (inscriptionInfo.sat === undefined || inscriptionInfo.sat === null) {
        throw new Error('Inscription ' + id + ' has no sat')
    }

    return inscriptionInfo.sat
}