import PocketBase from 'pocketbase'

const baseUrl =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_POCKETBASE_URL
    ? import.meta.env.VITE_POCKETBASE_URL
    : 'http://127.0.0.1:8090'

const pb = new PocketBase(baseUrl)
pb.autoCancellation(false)

export default pb
