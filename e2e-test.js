const BASE = 'http://localhost:3000/api';

async function test(name, fn) {
  try {
    const result = await fn();
    console.log('✓', name, result ? '- ' + JSON.stringify(result).substring(0, 100) : '');
    return true;
  } catch (e) {
    console.log('✗', name, '-', e.message);
    return false;
  }
}

async function runTests() {
  console.log('\n=== END-TO-END TESTS ===\n');

  // 1. Test Players API
  console.log('--- PLAYERS ---');
  await test('GET /api/players', async () => {
    const res = await fetch(BASE + '/players');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Not array');
    return { count: data.length };
  });

  // 2. Test Season API
  console.log('\n--- SEASON ---');
  await test('GET /api/season', async () => {
    const res = await fetch(BASE + '/season');
    const data = await res.json();
    return data ? { name: data.name, status: data.status } : 'null';
  });

  // 3. Test Bookings API
  console.log('\n--- TABLE BOOKINGS ---');
  const today = new Date().toISOString().split('T')[0];

  await test('GET /api/bookings/available', async () => {
    const res = await fetch(BASE + '/bookings/available?date=' + today);
    const data = await res.json();
    return { availableSlots: data.available?.length || 0 };
  });

  // 4. Create a booking
  let bookingId;
  await test('POST /api/bookings', async () => {
    const res = await fetch(BASE + '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1: 'Cameron McLain',
        player2: 'Alan Smith',
        booking_date: today,
        start_time: '14:00'
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed');
    }
    const data = await res.json();
    bookingId = data.booking?.id;
    return { id: bookingId };
  });

  // 5. Test Double-Booking Prevention
  await test('Double-booking blocked', async () => {
    const res = await fetch(BASE + '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1: 'SivaKumar',
        player2: 'Michael Schmidth',
        booking_date: today,
        start_time: '14:00'
      })
    });
    if (res.ok) throw new Error('Should have blocked double booking!');
    return { blocked: true };
  });

  // 6. Verify slot now shows as booked
  await test('Slot now booked', async () => {
    const res = await fetch(BASE + '/bookings/available?date=' + today);
    const data = await res.json();
    if (data.available?.includes('14:00')) throw new Error('14:00 should be unavailable');
    return { slotBooked: true };
  });

  // 7. Cancel booking
  if (bookingId) {
    await test('DELETE /api/bookings/:id', async () => {
      const res = await fetch(BASE + '/bookings/' + bookingId, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      return { cancelled: true };
    });
  }

  // 8. Test Leaderboard
  console.log('\n--- LEADERBOARD ---');
  await test('GET /api/leaderboard', async () => {
    const res = await fetch(BASE + '/leaderboard');
    const data = await res.json();
    return { players: Object.keys(data.players || {}).length };
  });

  // 9. Test Admin Login
  console.log('\n--- ADMIN ---');
  await test('Admin login (valid)', async () => {
    const res = await fetch(BASE + '/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Username' })
    });
    if (!res.ok) throw new Error('Login failed');
    return { success: true };
  });

  await test('Admin login (invalid)', async () => {
    const res = await fetch(BASE + '/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpassword' })
    });
    if (res.ok) throw new Error('Should have rejected');
    return { rejected: true };
  });

  // 10. Edge Cases
  console.log('\n--- EDGE CASES ---');
  await test('Create season without admin', async () => {
    const res = await fetch(BASE + '/season/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupA: [{name:'A'}], groupB: [{name:'B'}] })
    });
    if (res.ok) throw new Error('Should require admin');
    return { unauthorized: true };
  });

  await test('Book with missing fields', async () => {
    const res = await fetch(BASE + '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player1: 'Test' })
    });
    if (res.ok) throw new Error('Should require all fields');
    return { validation: true };
  });

  console.log('\n=== TESTS COMPLETE ===\n');
}

runTests().catch(console.error);
