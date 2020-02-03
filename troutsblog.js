/*
  Restarts the web server if a new hash is published to the BCH blockchain.
*/

'use strict'

const shell = require('shelljs')
const kill = require('tree-kill')

// App specific libraries.
// const config = require('./config')
const BCH = require(`./src/lib/bch`)
const bch = new BCH()
const ipfs = require('./src/lib/ipfs')
const config = require('./config')
const STATE = require(`./src/lib/state`)
const state = new STATE()
// Edit the period below, which dictates how often this app checks
// the BCH blockchain for updates.
// The time is in milliseconds (ms). 60,000 ms = 1 minute
const PERIOD = 60000 / 2

// Used for debugging and iterrogating JS objects.
const util = require('util')
util.inspect.defaultOptions = { depth: 1 }

// Start the IPFS blog web server. Restart it if a new hash is published to the
// BCH network.
let pid

const em = require('./src/lib/utils/eventJS')

let ipfsNode
async function manageServer () {
  ipfsNode = await ipfs.startIPFS()

  ipfsNode.on('ready', async () => {
    console.log('IPFS is ready...!')
    // Retrieve hash from BCH network and retrieve data from IPFS.
    // p-retry library -If it doesn't find the hash on the first try
    let hash = await bch.pRetryGetHash()

    // Exit if no hash is found.
    if (!hash) {
      console.log(
        `Could not find IPFS hash associated with BCH address ${config.BCHADDR}`
      )
      console.log(
        `Publish an IPFS hash using the memo-push tool before running this server.`
      )
      console.log(`Exiting`)
      process.exit()
    }
    console.log(`Downloading content associated with this IPFS hash: ${hash}`)
    await ipfsGet(hash)

    try {
      // Start the web server.
      console.log('Start the web server.')
      const server = shell.exec('node index.js', { async: true })
      pid = server.pid
      // console.log(`server : ${util.inspect(server)}`)
      // console.log(`pid: ${server.pid}`)

      let serverInterval = setInterval(initServer, PERIOD)

      // Checking if IPFS is downloading new content
      em.on('download-start', () => {
        console.log('Update Interval Stopped')
        console.log('Downloading new content')
        clearInterval(serverInterval)
        serverInterval = null
        // console.log(serverInterval)
      })
      em.on('download-stop', () => {
        console.log('IPFS Download finished..!')
        console.log('Resuming update interval')
        serverInterval = setInterval(initServer, PERIOD)
      })
    } catch (err) {
      console.error(err)
    }
  })
}

// Promise based sleep function:
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function initServer () {
  console.log(`Checking for updates...`)
  // Check for updates. Will usually return false.
  const hash = await bch.checkForUpdates(pid)
  if (!hash) {
    console.log(`No updates found.`)
    console.log(` `)
  }

  // If a hash is returned, then restart the web server.
  if (hash) {
    await ipfsGet(hash)
    await state.setLastHash(hash)
    kill(pid)
    console.log('Restarting server...')
    await sleep(5000)

    const server = shell.exec('node index.js', { async: true })
    pid = server.pid
  }
}

// Get content from the IPFS network.
async function ipfsGet (hash) {
  // Get the latest content from the IPFS network and Add into ipfs-data.
  await ipfs.getContent(ipfsNode, hash)
  console.log(`Updated content!`)

  // Adds an IPFS object to the pinset and also stores it to the IPFS repo.
  await ipfs.pinAdd(ipfsNode, hash)
  console.log(`New content published with hash ${hash}`)
}

manageServer()
