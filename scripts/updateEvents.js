import 'dotenv/config'

import fs from 'fs'
import { uniqBy } from 'lodash'

import networkConfig from '../networkConfig'
import ABI from '../abis/Instance.abi.json'
import { loadCachedEvents, getPastEvents } from './helpers'

const EVENTS_PATH = './static/events/'
const EVENTS = ['Deposit', 'Withdrawal']
const enabledChains = ['56']

async function main(type, netId) {
  const { tokens, nativeCurrency, deployedBlock } = networkConfig[`netId${netId}`]
  const CONTRACTS = tokens[nativeCurrency].instanceAddress

  for (const [instance, _contract] of Object.entries(CONTRACTS)) {
    const cachedEvents = await loadCachedEvents({
      name: `${type.toLowerCase()}s_${nativeCurrency}_${instance}.json`,
      directory: EVENTS_PATH,
      deployedBlock
    })

    console.log('cachedEvents count - ', cachedEvents.events.length)
    console.log('lastBlock - ', cachedEvents.lastBlock)

    let events = []

    events = await getPastEvents({
      type,
      netId,
      events,
      contractAttrs: [ABI, _contract],
      fromBlock: cachedEvents.lastBlock * 1 + 1
    })
    console.log('///////events//////////', events)

    if (type === 'Deposit') {
      // events = events.map(({ blockNumber, transactionHash, returnValues }) => {
      events = events.map(({ block_number, transaction_hash, data }) => {
        const { commitment, leafIndex, timestamp } = data
        return {
          timestamp,
          commitment,
          blockNumber: Number(block_number),
          transactionHash: transaction_hash,
          leafIndex: Number(leafIndex)
        }
      })
    }

    if (type === 'Withdrawal') {
      events = events.map(({ block_number, transaction_hash, data }) => {
        const { nullifierHash, to, fee } = data
        return {
          to,
          fee,
          blockNumber: Number(block_number),
          nullifierHash,
          transactionHash: transaction_hash,
        }
      })
    }
    console.log('debug before', cachedEvents.events.length - 1, cachedEvents.events.slice(-1))
    let freshEvents = cachedEvents.events.concat(events.sort((a, b) => a.leafIndex - b.leafIndex))

    if (type === 'Withdrawal') {
      freshEvents = uniqBy(freshEvents, 'nullifierHash').sort((a, b) => b.blockNumber - a.blockNumber)
    } else {
      freshEvents = freshEvents.filter((e, index) => Number(e.leafIndex) === index)
    }
    console.log('debug after', freshEvents.length - 1, events.slice(-1))

    const eventsJson = JSON.stringify(freshEvents, null, 2) + '\n'
    fs.writeFileSync(`${EVENTS_PATH}${type.toLowerCase()}s_${nativeCurrency}_${instance}.json`, eventsJson)
  }
}

async function start() {
  const [, , , chain] = process.argv
  if (!enabledChains.includes(chain)) {
    throw new Error(`Supported chain ids ${enabledChains.join(', ')}`)
  }

  for await (const event of EVENTS) {
    await main(event, chain)
  }
}

start()
