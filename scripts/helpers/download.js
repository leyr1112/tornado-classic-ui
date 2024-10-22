import fs from 'fs'
import Jszip from 'jszip'
import Web3 from 'web3'
import Axios from 'axios'
import networkConfig from '../../networkConfig'

const jszip = new Jszip()
const topics = {
  'Deposit': '0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196',
  'Withdrawal': '0xe9e508bad6d4c3227e881ca19068f099da81b5164dd6d62b2eaf1e8bc6c34931',
  'EncryptedNote': '0xfa28df43db3553771f7209dcef046f3bdfea15870ab625dcda30ac58b82b4008',
}

const netName = {
  '1': 'eth',
  '56': 'bsc'
}

const abis = {
  'Deposit': {
    'anonymous': false,
    'inputs': [{
        'indexed': true,
        'internalType': 'bytes32',
        'name': 'commitment',
        'type': 'bytes32'
      },
      {
        'indexed': false,
        'internalType': 'uint32',
        'name': 'leafIndex',
        'type': 'uint32'
      },
      {
        'indexed': false,
        'internalType': 'uint256',
        'name': 'timestamp',
        'type': 'uint256'
      }
    ],
    'name': 'Deposit',
    'type': 'event'
  },
  'Withdrawal': {
    "anonymous": false,
    "inputs": [{
      "indexed": false,
      "internalType": "address",
      "name": "to",
      "type": "address"
    }, {
      "indexed": false,
      "internalType": "bytes32",
      "name": "nullifierHash",
      "type": "bytes32"
    }, {
      "indexed": true,
      "internalType": "address",
      "name": "relayer",
      "type": "address"
    }, {
      "indexed": false,
      "internalType": "uint256",
      "name": "fee",
      "type": "uint256"
    }],
    "name": "Withdrawal",
    "type": "event"
  },
  'EncryptedNote': {
    "anonymous": false,
    "inputs": [{
      "indexed": true,
      "internalType": "address",
      "name": "sender",
      "type": "address"
    }, {
      "indexed": false,
      "internalType": "bytes",
      "name": "encryptedNote",
      "type": "bytes"
    }],
    "name": "EncryptedNote",
    "type": "event"
  }
}

export async function download({
  name,
  directory,
  contentType
}) {
  const path = `${directory}${name}.zip`.toLowerCase()

  const data = fs.readFileSync(path)
  const zip = await jszip.loadAsync(data)

  const file = zip.file(
    path
    .replace(directory, '')
    .slice(0, -4)
    .toLowerCase()
  )

  const content = await file.async(contentType)

  return content
}

export async function loadCachedEvents({
  name,
  directory,
  deployedBlock
}) {
  try {
    const module = await download({
      contentType: 'string',
      directory,
      name
    })

    if (module) {
      const events = JSON.parse(module)

      const [lastEvent] = JSON.parse(module).sort(
        (a, b) => (b.block || b.blockNumber) - (a.block || a.blockNumber)
      )
      const lastBlock = lastEvent.block || lastEvent.blockNumber

      return {
        events,
        lastBlock
      }
    }
  } catch (err) {
    console.error(`Method loadCachedEvents has error: ${err.message}`)
    return {
      events: [],
      lastBlock: deployedBlock
    }
  }
}

export async function getPastEvents({
  type,
  fromBlock,
  netId,
  events,
  contractAttrs
}) {
  let downloadedEvents = events

  let [{
    url: rpcUrl
  }] = Object.values(networkConfig[`netId${netId}`].rpcUrls)

  if (netId === '5') {
    rpcUrl = `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`
  }

  const provider = new Web3.providers.HttpProvider(rpcUrl)
  const web3 = new Web3(provider)
  // const contract = new web3.eth.Contract(...contractAttrs)

  const currentBlockNumber = await web3.eth.getBlockNumber()
  // const blockDifference = Math.ceil(currentBlockNumber - fromBlock)

  // const blockRange = Number(netId) === 56 ? 4950 : blockDifference / 500

  // let chunksCount = blockDifference === 0 ? 1 : Math.ceil(blockDifference / blockRange)
  let chunksCount = 1
  // const chunkSize = Math.ceil(blockDifference / chunksCount)

  // let toBlock = fromBlock + chunkSize
  console.log('debug passing here', fromBlock, currentBlockNumber)
  if (fromBlock < currentBlockNumber) {
    // if (toBlock >= currentBlockNumber) {
    //   toBlock = currentBlockNumber
    //   chunksCount = 1
    // }
    let total = 0

    console.log(`Fetching ${type}, chainId - ${netId}`, `chunksCount - ${chunksCount}`)
    for (let i = 0; i < chunksCount; i++)
      try {
        await new Promise((resolve) => setTimeout(resolve, 200))

        console.log(`fromBlock - ${fromBlock}`)
        // console.log(`toBlock - ${toBlock}`)
        console.log(`${i*500} ~ ${i*500 + 499} of ${total}`)

        const response = await Axios.post(
          'https://deep-index.moralis.io/api/v2/' + contractAttrs[1] + '/events',
          // '\n{\n  "anonymous": false,\n  "inputs": [\n    {\n      "indexed": true,\n      "internalType": "bytes32",\n      "name": "commitment",\n      "type": "bytes32"\n    },\n    {\n      "indexed": false,\n      "internalType": "uint32",\n      "name": "leafIndex",\n      "type": "uint32"\n    },\n    {\n      "indexed": false,\n      "internalType": "uint256",\n      "name": "timestamp",\n      "type": "uint256"\n    }\n  ],\n  "name": "Deposit",\n  "type": "event"\n}\n',
          abis[type], {
            params: {
              'chain': netName[netId],
              'from_block': fromBlock,
              'to_block': currentBlockNumber,
              'limit': 500,
              'offset': i * 500,
              'topic': topics[type]
            },
            headers: {
              'accept': 'application/json',
              'X-API-Key': 'BWTcVib0nA0cgsZLa6VDx8mo0Mx0ezqbDnAICfCT4CZlGnsvqgqYIlA2nRz9mzkQ',
              'content-type': 'application/json'
            }
          }
        );

        // const eventsChunk = await contract.getPastEvents(type, { fromBlock, toBlock })
        const eventsChunk = response.data.result
        chunksCount = Math.ceil(response.data.total / 500)
        total = response.data.total * 1

        if (eventsChunk) {
          downloadedEvents = downloadedEvents.concat(eventsChunk)
          console.log('downloaded events count - ', eventsChunk.length)
          console.log('____________________________________________')
        }
        // fromBlock = toBlock
        // toBlock += chunkSize
      } catch (err) {
        console.log('getPastEvents events', `chunk number - ${i}, has error: ${err.message}`)
        chunksCount = chunksCount + 1
      }
  }
  return downloadedEvents
}