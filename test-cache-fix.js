const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function testCacheFix() {
  const testPlayer = 'Ritesh Varma'; // Use your actual player name
  const testDate = new Date().toISOString().split('T')[0];
  const testSlots = ['14:00', '14:30', '15:00'];

  try {
    console.log('🧪 Testing cache fix for availability persistence\n');

    // Test 1: Clear any existing data for test player
    console.log('1. Clearing test player availability...');
    await fetch(`${API_BASE}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [testPlayer]: {} })
    });
    console.log('   ✓ Cleared\n');

    // Test 2: Save new availability
    console.log('2. Saving new availability...');
    console.log(`   Player: ${testPlayer}`);
    console.log(`   Date: ${testDate}`);
    console.log(`   Slots: ${testSlots.join(', ')}`);

    const saveResponse = await fetch(`${API_BASE}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [testPlayer]: {
          [testDate]: testSlots
        }
      })
    });

    if (!saveResponse.ok) {
      console.error('   ❌ Save failed:', await saveResponse.text());
      return;
    }
    console.log('   ✓ Saved successfully\n');

    // Test 3: Fetch immediately (should show new data)
    console.log('3. Fetching immediately after save...');
    const fetch1 = await fetch(`${API_BASE}/availability`);
    const headers1 = {
      'cache-control': fetch1.headers.get('cache-control'),
      'pragma': fetch1.headers.get('pragma'),
      'expires': fetch1.headers.get('expires')
    };
    console.log('   Response headers:', headers1);
    console.log('   Status:', fetch1.status);

    const data1 = await fetch1.json();
    const playerData1 = data1[testPlayer]?.[testDate] || [];
    console.log(`   ${testPlayer} slots:`, playerData1);

    if (playerData1.length === testSlots.length) {
      console.log('   ✓ Data loaded correctly\n');
    } else {
      console.log('   ❌ Data mismatch!\n');
    }

    // Test 4: Fetch again with 2 second delay (simulating page refresh)
    console.log('4. Waiting 2 seconds and fetching again...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fetch2 = await fetch(`${API_BASE}/availability`, {
      cache: 'no-store' // Force no cache on client side too
    });
    console.log('   Status:', fetch2.status);

    const data2 = await fetch2.json();
    const playerData2 = data2[testPlayer]?.[testDate] || [];
    console.log(`   ${testPlayer} slots:`, playerData2);

    if (playerData2.length === testSlots.length) {
      console.log('   ✓ Data persisted correctly!\n');
    } else {
      console.log('   ❌ Data disappeared after delay!\n');
    }

    // Test 5: Check if cache headers are present
    console.log('5. Final check of cache headers...');
    const fetch3 = await fetch(`${API_BASE}/availability`);
    const cacheControl = fetch3.headers.get('cache-control');
    const pragma = fetch3.headers.get('pragma');
    const expires = fetch3.headers.get('expires');

    console.log('   Cache-Control:', cacheControl);
    console.log('   Pragma:', pragma);
    console.log('   Expires:', expires);

    if (cacheControl && cacheControl.includes('no-cache')) {
      console.log('\n✅ CACHE FIX IS WORKING - Headers are set correctly!');
    } else {
      console.log('\n❌ CACHE FIX NOT DEPLOYED YET - Headers missing!');
      console.log('   Wait a few minutes for Vercel to finish deploying.');
    }

    // Final data check
    const finalData = await fetch3.json();
    const finalPlayerData = finalData[testPlayer]?.[testDate] || [];

    if (finalPlayerData.length === testSlots.length) {
      console.log('✅ AVAILABILITY IS PERSISTING CORRECTLY!\n');
    } else {
      console.log('❌ AVAILABILITY IS NOT PERSISTING!\n');
      console.log('Debug info:');
      console.log('  Expected slots:', testSlots);
      console.log('  Actual slots:', finalPlayerData);
      console.log('  Full data:', finalData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCacheFix();
