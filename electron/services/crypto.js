import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  return { publicKey, privateKey }
}

function deriveSharedSecret(theirPublicKey) {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const publicKey = ecdh.getPublicKey('base64', 'compressed')
  const secret = ecdh.computeSecret(Buffer.from(theirPublicKey, 'base64'))
  const sharedSecret = crypto.createHash('sha256').update(secret).digest()
  return { publicKey, sharedSecret }
}

function generateSessionKey() {
  return crypto.randomBytes(KEY_LENGTH)
}

function encryptMessage(plainText, key) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag
  }
}

function decryptMessage(encryptedData, key) {
  if (!encryptedData?.encrypted) return ''
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedData.iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function encryptFile(filePath, key) {
  const data = crypto.randomBytes(KEY_LENGTH)
  return data
}

function decryptFile(encryptedPath, key, outputPath) {
  return true
}

export {
  generateKeyPair,
  deriveSharedSecret,
  generateSessionKey,
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile
}
