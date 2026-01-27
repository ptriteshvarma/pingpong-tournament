const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function testAvailability() {
  try {
    console.log('🔍 Testing availability persistence...\n');

    // Test 1: Check if we can fetch availability
    console.log('1. Fetching current availability...');
    const getResponse = await fetch(`${API_BASE}/availability`);
    const currentData = await getResponse.json();
    console.log('   Current availability:', JSON.stringify(currentData, null, 2));

    // Test 2: Try to save some test availability
    const testPlayer = 'Test Player';
    const testDate = new Date().toISOString().split('T')[0];
    const testData = {
      [testPlayer]: {
        [testDate]: ['09:00', '10:00', '11:00']
      }
    };

    console.log('\n2. Saving test availability...');
    console.log('   Data to save:', JSON.stringify(testData, null, 2));

    const saveResponse = await fetch(`${API_BASE}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('   ❌ Save failed:', errorText);
      return;
    }

    const saveResult = await saveResponse.json();
    console.log('   ✓ Save response:', saveResult);

    // Test 3: Fetch again to verify it persisted
    console.log('\n3. Fetching again to verify...');
    const verifyResponse = await fetch(`${API_BASE}/availability`);
    const verifyData = await verifyResponse.json();
    console.log('   Updated availability:', JSON.stringify(verifyData, null, 2));

    if (verifyData[testPlayer]) {
      console.log('\n✅ SUCCESS! Availability is persisting correctly!');
    } else {
      console.log('\n❌ FAILED! Availability was saved but disappeared!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAvailability();
