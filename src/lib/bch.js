/*
  This library contains the application logic for working with the BCH blockchain
  and decoding memo.cash protocol messages from BCH transactions.
*/

'use strict'

// const shell = require('shelljs')

const config = require('../../config')
const pRetry = require('p-retry')

const bchjs = new config.BCHLIB({ restURL: config.MAINNET_REST })

const ADDR = config.BCHADDR

const STATE = require(`./state`)
const state = new STATE()

// Delay between attempts to get the latest IPFS hash-link from the BCH blockchain.
const TIMEOUT = 1000

let _this
class BCH {
  constructor (hash, retries) {
    this.bchjs = bchjs
    _this = this

    // By default make hash an empty string.
    _this.currentHash = ''

    // Amount of times to retry getting the IPFS hash-link from the BCH blockchain
    // before giving up.
    _this.retries = 5 // Default value of 5.

    // Override default retry value if overridden by caller.
    if (retries && retries > 0) _this.retries = retries

    // If user specified a hash to use, use that.
    if (hash && hash !== '') _this.currentHash = hash
  }

  // Checks to see if a new hash been published to the BCH network. If a new
  // hash is detected, it returns the hash. Otherwise, it returns false.
  async checkForUpdates () {
    const hash = await _this.findHash()

    // Handle initializing the server.
    if (_this.currentHash === '') _this.currentHash = hash
    console.log(`_this.currentHash: ${_this.currentHash}`)

    // If new hash is detected.
    if (hash !== _this.currentHash) {
      _this.currentHash = hash

      return hash
    }

    return false
  }

  // Walk the transactions associated with an address until a proper IPFS hash is
  // found. If one is not found, will return false.
  async findHash () {
    try {
      // Get details associated with this apps BCH address.
      const details = await _this.bchjs.Blockbook.balance(ADDR)
      console.log(`Retrieving transaction history for BCH address ${ADDR}`)

      // Extract the list of transaction IDs involving this address.
      const TXIDs = details.txids
      // console.log(`TXIDs: ${JSON.stringify(TXIDs, null, 2)}`)

      // Loop through each transaction associated with this address.
      for (let i = 0; i < TXIDs.length; i++) {
        const thisTXID = TXIDs[i]

        const thisTx = await _this.bchjs.RawTransactions.getRawTransaction(
          thisTXID,
          true
        )
        // console.log(`thisTx: ${JSON.stringify(thisTx, null, 2)}`)
        // Loop through all the vout entries.
        for (let j = 0; j < thisTx.vout.length; j++) {
          const thisVout = thisTx.vout[j]
          // Assembly representation.
          const asm = thisVout.scriptPubKey.asm
          // console.log(`asm: ${asm}`)

          const msg = _this.decodeTransaction(asm)
          if (msg) {
            // console.log(`msg: ${msg}`)

            const hash = _this.filterHash(msg)
            if (hash) {
              //  console.log(`Hash found! ${hash}`)
              return hash
            }
          }
        }
      }
      return false
    } catch (err) {
      console.log(`Could not find IPFS hash in transaction history.`)
      return false
    }
  }

  // Filters a string to see if it matches the proper pattern of:
  // 'IPFS UPDATE <hash>'
  // Returns the hash if the pattern matches. Otherwise, returns false.
  filterHash (msg) {
    try {
      if (msg.indexOf('IPFS UPDATE') > -1) {
        const parts = msg.split(' ')
        const hash = parts.pop()

        if (hash.length === 46) {
          return hash
        }

        return false
      }
    } catch (err) {
      // Exit silently
      return false
    }
  }

  // Decodes BCH transaction assembly code. If it matches the memo.cash
  // protocol for posts, it returns the post message. Otherwise returns false.
  decodeTransaction (asm) {
    try {
      // Decode the assembly into a string.
      let fromASM = _this.bchjs.Script.fromASM(asm)
      let decodedArr = _this.bchjs.Script.decode(fromASM).toString()
      // console.log(`decodedArr: ${util.inspect(decodedArr)}`)

      // Split the string based on commas.
      const splitStr = decodedArr.split(',')

      // Detect OP_RETURN & Memo Cash message
      if (splitStr[0] === '106' && splitStr[1] === 'b') {
        // console.log(`splitStr: ${JSON.stringify(splitStr, null, 2)}`)

        // Get the last element from the array.
        const endStr = splitStr.pop()
        // console.log(`endStr: ${endStr}`)

        // Return the message.
        return endStr
      }

      return false
    } catch (err) {
      // Exit quietly
      return false
    }
  }

  // Gets the latest IPFS hash. Will retry if it fails.
  async pRetryGetHash () {
    // Try to retrieve the hash from the state file first.
    let hash = await _this.getHashFromState()

    try {
      hash = await pRetry(tryFindHash, {
        onFailedAttempt: async () => {
          //   failed attempt.
          _this.sleep(TIMEOUT)
        },
        retries: _this.retries
      })

      // Update thet state file with the new hash.
      await state.setLastHash(hash)

      return hash
    } catch (error) {
      if (hash) {
        console.log(`Hash not found, setting the lash hash used : ${hash}`)
      }
      return hash
      // console.log(error)
    }
  }

  // Get the IPFS hash-link from the state file.
  async getHashFromState () {
    try {
      const lasth = await state.getLastHash()
      return lasth
    } catch (error) {
      return null
    }
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Try get the latest hash off the BCH network.
const tryFindHash = async () => {
  console.log(`Trying get hash`)
  const bch = new BCH()
  const hash = await bch.findHash()
  if (!hash) {
    throw new Error()
  } else {
    return hash
  }
}

module.exports = BCH
