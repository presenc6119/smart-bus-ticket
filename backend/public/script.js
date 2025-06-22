let studentId = localStorage.getItem('studentId');
const ROWS = 5;
const COLS = 4;
let busList = [];


function populateBusDropdown() {
    fetch('/api/buses')
        .then(res => res.json())
        .then(buses => {
            busList = buses;

            const fromSelect = document.getElementById('from');
            const toSelect = document.getElementById('to');
            fromSelect.innerHTML = '<option value="">From</option>';
            toSelect.innerHTML = '<option value="">To</option>';

            // Gather all unique stops from all buses
            const uniqueStops = Array.from(new Set(
                buses.flatMap(bus => bus.stops)
            ));

            uniqueStops.forEach(stop => {
                const optionFrom = document.createElement('option');
                optionFrom.value = stop;
                optionFrom.textContent = stop;
                fromSelect.appendChild(optionFrom);

                const optionTo = document.createElement('option');
                optionTo.value = stop;
                optionTo.textContent = stop;
                toSelect.appendChild(optionTo);
            });
        });
}

function updateBusDropdown() {
    const busSelect = document.getElementById('bus');
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;

    busSelect.innerHTML = '<option value="">Select a bus and time</option>';

    if (!from || !to || from === to) {
        // Show all buses if from/to not selected or same
        busList.forEach(bus => {
            const option = document.createElement('option');
            option.value = bus.id;
            option.textContent = `${bus.name} (${bus.time})`;
            busSelect.appendChild(option);
        });
        return;
    }

    // Only show buses that visit both stops in order
    busList.forEach(bus => {
        const fromIdx = bus.stops.indexOf(from);
        const toIdx = bus.stops.indexOf(to);
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
            const option = document.createElement('option');
            option.value = bus.id;
            option.textContent = `${bus.name} (${bus.time})`;
            busSelect.appendChild(option);
        }
    });
}

function getBusDisplay(busId) {
    const bus = busList.find(b => b.id === busId);
    return bus ? `${bus.name} (${bus.time})` : busId;
}

// Call this on page load
window.onload = function () {
    populateBusDropdown();
    document.getElementById('register').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    if (studentId) {
        document.getElementById('login').classList.add('hidden');
        document.getElementById('booking').classList.remove('hidden');
        document.getElementById('bookings').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        loadBookings();
    }
};

function renderSeatingChart(bookedSeats = []) {
    const chart = document.getElementById('seatingChart');
    chart.innerHTML = '';
    const bookedNums = bookedSeats.map(Number);
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const seatNum = row * COLS + col + 1;
            const seatDiv = document.createElement('div');
            seatDiv.className = 'seat';
            seatDiv.innerText = seatNum;
            if (bookedNums.includes(seatNum)) {
                seatDiv.classList.add('booked');
            } else {
                seatDiv.onclick = function () {
                    document.querySelectorAll('.seat.selected').forEach(s => s.classList.remove('selected'));
                    seatDiv.classList.add('selected');
                    document.getElementById('selectedSeat').value = seatNum;
                };
            }
            chart.appendChild(seatDiv);
        }
    }
}

// Show registration form
function showRegister() {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('register').classList.remove('hidden');
    document.getElementById('registerError').innerText = '';
    document.getElementById('registerSuccess').innerText = '';
}

// Show login form
function showLogin() {
    document.getElementById('register').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
}

function register() {
    const id = document.getElementById('regStudentId').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    errorDiv.innerText = '';
    successDiv.innerText = '';

    if (!/^s(0[0-9][1-9]|0[1-9][0-9]|100)$/.test(id)) {
        errorDiv.innerText = 'Student ID must be from s001 to s100.';
        return;
    }
    if (!password) {
        errorDiv.innerText = 'Password required.';
        return;
    }

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                errorDiv.innerText = data.error;
            } else {
                successDiv.innerText = 'Registration successful! You can now log in.';
            }
        })
        .catch(() => {
            errorDiv.innerText = 'Registration failed. Try again.';
        });
}

function login() {
    const id = document.getElementById('studentId').value;
    const password = document.getElementById('password').value;
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
    })
        .then(res => {
            if (!res.ok) throw new Error('Login failed');
            return res.json();
        })
        .then(data => {
            studentId = data.id;
            localStorage.setItem('studentId', studentId);
            document.getElementById('login').classList.add('hidden');
            document.getElementById('booking').classList.remove('hidden');
            document.getElementById('bookings').classList.remove('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            loadBookings();
        })
        .catch(() => {
            document.getElementById('loginError').innerText = 'Invalid ID or password.';
        });
}

function logout() {
    localStorage.removeItem('studentId');
    studentId = null;
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('booking').classList.add('hidden');
    document.getElementById('bookings').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
}

function bookBus() {
    const bus = document.getElementById('bus').value;
    const date = document.getElementById('date').value;
    const seat = document.getElementById('selectedSeat').value;
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    if (!bus || !date || !seat || !from || !to) {
        document.getElementById('bookMsg').innerText = 'Please select bus, date, from, to, and seat.';
        return;
    }
    if (from === to) {
        document.getElementById('bookMsg').innerText = 'From and To cannot be the same.';
        return;
    }
    fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, bus, date, seat, from, to })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                document.getElementById('bookMsg').innerText = data.error;
            } else {
                document.getElementById('bookMsg').innerText = 'Booking successful!';
                loadBookings();
            }
        });
}

function to24Hour(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    if (modifier === 'PM' && hours !== 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

function loadBookings() {
    fetch(`/api/bookings/${studentId}`)
        .then(res => res.json())
        .then(bookings => {
            const list = document.getElementById('bookingList');
            list.innerHTML = '';
            const now = new Date();
            const bufferMs = 10 * 60 * 1000;
            const nowWithBuffer = new Date(now.getTime() - bufferMs);
            bookings.forEach(b => {
                const bus = busList.find(bus => bus.id === b.bus);
                if (!bus) return;
                const toIdx = bus.stops.indexOf(b.to_stop);
                let endTime = bus.time;
                if (toIdx !== -1 && bus.schedule[toIdx]) {
                    endTime = bus.schedule[toIdx];
                }

                let endDateTime = new Date(`${b.date}T${to24Hour(endTime)}`);
                if (isNaN(endDateTime.getTime())) {
                    const li = document.createElement('li');
                    li.innerText = `Bus: ${getBusDisplay(b.bus)}, Date: ${b.date}, From: ${b.from_stop}, To: ${b.to_stop}, Seat: ${b.seat || 'N/A'}`;
                    list.appendChild(li);
                    return;
                }
                if (endDateTime > nowWithBuffer) {
                    const fromIdx = bus.stops.indexOf(b.from_stop);
                    let fromTime = bus.time;
                    if (fromIdx !== -1 && bus.schedule[fromIdx]) {
                        fromTime = bus.schedule[fromIdx];
                    }
                    const li = document.createElement('li');
                    li.innerText = `Bus: ${getBusDisplay(b.bus)}, Date: ${b.date}, From: ${b.from_stop} (${fromTime}), To: ${b.to_stop}, Seat: ${b.seat || 'N/A'}`;

                    const cancelBtn = document.createElement('button');
                    cancelBtn.innerText = 'Cancel';
                    cancelBtn.style.marginLeft = '10px';
                    cancelBtn.onclick = function () {
                        if (confirm('Are you sure you want to cancel this booking?')) {
                            fetch(`/api/bookings/${b.id}`, { method: 'DELETE' })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success) {
                                        loadBookings();
                                    } else {
                                        alert('Failed to cancel booking.');
                                    }
                                });
                        }
                    };
                    li.appendChild(cancelBtn);

                    list.appendChild(li);
                }
            });
        });

    // Fetch all bookings for the selected bus/date to mark booked seats
    const bus = document.getElementById('bus').value;
    const date = document.getElementById('date').value;
    if (bus && date) {
        fetch(`/api/bookings/all?bus=${encodeURIComponent(bus)}&date=${encodeURIComponent(date)}`)
            .then(res => res.json())
            .then(allBookings => {
                const bookedSeats = allBookings.map(b => Number(b.seat)).filter(Boolean);
                console.log('Booked seats:', bookedSeats);
                renderSeatingChart(bookedSeats);
            });
    } else {
        renderSeatingChart([]);
    }
}

function showBusSchedule() {
    const busId = document.getElementById('bus').value;
    const scheduleDiv = document.getElementById('busSchedule');
    scheduleDiv.innerHTML = '';
    if (!busId) return;
    const bus = busList.find(b => b.id === busId);
    if (!bus || !bus.schedule) return;
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<tr><th>Stop</th><th>Time</th></tr>';
    for (let i = 0; i < bus.stops.length; i++) {
        const stopName = bus.stops[i];
        const stopTime = bus.schedule[i];
        const row = document.createElement('tr');
        row.innerHTML = `<td>${stopName}</td><td>${stopTime}</td>`;
        table.appendChild(row);
    }
    scheduleDiv.appendChild(table);
}

document.getElementById('findRoutesBtn').onclick = function () {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const date = document.getElementById('date').value;
    if (!from || !to || from === to || !date) {
        document.getElementById('findMsg').innerText = 'Please select valid From, To, and Date.';
        return;
    }

    let found = false;
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const bus of busList) {
        const fromIndices = [];
        const toIndices = [];
        bus.stops.forEach((stop, idx) => {
            if (stop === from) fromIndices.push(idx);
            if (stop === to) toIndices.push(idx);
        });

        for (const fromIdx of fromIndices) {
            for (const toIdx of toIndices) {
                if (fromIdx < toIdx) {
                    if (date === todayStr) {
                        const fromTime = bus.schedule[fromIdx];
                        const now = new Date();
                        const fromDateTime = new Date(`${date}T${to24Hour(fromTime)}`);
                        if (fromDateTime < now) continue;
                    }
                    window.location.href = `routes.html?from=${bus.id}:${fromIdx}&to=${bus.id}:${toIdx}&date=${encodeURIComponent(date)}`;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }
    if (!found) {
        document.getElementById('findMsg').innerText = 'No bus found for this route.';
    }
};