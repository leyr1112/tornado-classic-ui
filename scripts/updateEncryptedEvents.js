import 'dotenv/config'

import fs from 'fs'
import { uniqBy } from 'lodash'

import networkConfig from '../networkConfig'
import ABI from '../abis/TornadoProxy.abi.json'
import { getPastEvents, loadCachedEvents } from './helpers'

const EVENTS_PATH = './static/events/'
const enabledChains = ['1', '5', '56']

async function saveEncryptedNote(netId) {
  const {
    constants,
    'tornado-proxy.contract.tornadocash.eth': tornadoProxy,
    'tornado-router.contract.tornadocash.eth': tornadoRouter,
    'tornado-proxy-light.contract.tornadocash.eth': lightProxy
  } = networkConfig[`netId${netId}`]

  const contractAddress = tornadoRouter || tornadoProxy || lightProxy

  let encryptedEvents = []
  const name = `encrypted_notes_${netId}.json`

  const cachedEvents = await loadCachedEvents({
    name,
    directory: EVENTS_PATH,
    deployedBlock: constants.ENCRYPTED_NOTES_BLOCK
  })

  console.log('cachedEvents', cachedEvents.events.length)

  encryptedEvents = await getPastEvents({
    netId,
    type: 'EncryptedNote',
    events: encryptedEvents,
    fromBlock: cachedEvents.lastBlock * 1 + 1,
    contractAttrs: [ABI, contractAddress]
  })

  console.log('Encrypted note', netId, encryptedEvents.length)

  encryptedEvents = encryptedEvents.reduce((acc, curr) => {
    if (curr.data.encryptedNote) {
      acc.push({
        txHash: curr.transaction_hash,
        blockNumber: Number(curr.block_number),
        encryptedNote: curr.data.encryptedNote
      })
    }
    return acc
  }, [])

  let freshEvents = cachedEvents.events.concat(encryptedEvents)
  console.log('debug before', cachedEvents.length, encryptedEvents.length, freshEvents.length)

  freshEvents = uniqBy(freshEvents, 'encryptedNote').sort((a, b) => b.blockNumber - a.blockNumber)

  console.log('debug after', freshEvents.length)
  const eventsJson = JSON.stringify(freshEvents, null, 2) + '\n'
  fs.writeFileSync(`${EVENTS_PATH}${name}`, eventsJson)
}

async function main() {
  const [, , , chain] = process.argv
  if (!enabledChains.includes(chain)) {
    throw new Error(`Supported chain ids ${enabledChains.join(', ')}`)
  }

  await saveEncryptedNote(chain)
}

main()
