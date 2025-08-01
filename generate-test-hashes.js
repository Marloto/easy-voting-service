const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

function generateHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateTestData() {
  // Generate client-side keys (these would normally be generated in browser)
  const sessionId = uuidv4();
  const masterKey = uuidv4();
  const voterId1 = uuidv4();
  const voterId2 = uuidv4();
  
  // Generate hashes for API calls
  const storageHash = generateHash(sessionId);
  const masterHash = generateHash(masterKey);
  const voterHash1 = generateHash(voterId1);
  const voterHash2 = generateHash(voterId2);
  
  console.log('=== Generated Test Data ===\n');
  
  console.log('Client-side keys (keep secret):');
  console.log(`sessionId: ${sessionId}`);
  console.log(`masterKey: ${masterKey}`);
  console.log(`voterId1:  ${voterId1}`);
  console.log(`voterId2:  ${voterId2}\n`);
  
  console.log('Hashes for API calls:');
  console.log(`storageHash: ${storageHash}`);
  console.log(`masterHash:  ${masterHash}`);
  console.log(`voterHash1:  ${voterHash1}`);
  console.log(`voterHash2:  ${voterHash2}\n`);
  
  console.log('Update your test-api.http file with these values:');
  console.log(`@storageHash = ${storageHash}`);
  console.log(`@masterHash = ${masterHash}`);
  console.log(`@voterHash1 = ${voterHash1}`);
  console.log(`@voterHash2 = ${voterHash2}\n`);
  
  console.log('=== QR Code Content ===');
  console.log(`Share this sessionId via QR code: ${sessionId}\n`);
  
  console.log('=== Client-side Key Derivation Example ===');
  console.log('// In client JavaScript:');
  console.log(`// const sessionId = "${sessionId}"; // from QR code`);
  console.log('// const storageHash = sha256(sessionId);');
  console.log('// const sessionKey = deriveKey(sessionId + "config");');
  console.log('// const voterKey = deriveKey(voterId + sessionId + "vote");');
}

generateTestData();