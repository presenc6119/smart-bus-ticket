const urlParams = new URLSearchParams(window.location.search);
const [fromBusId, fromIdxStr] = urlParams.get('from').split(':');
const [toBusId, toIdxStr] = urlParams.get('to').split(':');
const fromIdx = parseInt(fromIdxStr, 10);
const toIdx = parseInt(toIdxStr, 10);
const date = urlParams.get('date');


document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/buses')
        .then(res => res.json())
        .then(buses => {
            const routesList = document.getElementById('routesList');
            const bus = buses.find(b => b.id === fromBusId);
            if (
                bus &&
                fromIdx >= 0 && toIdx >= 0 &&
                fromIdx < bus.stops.length &&
                toIdx < bus.stops.length &&
                fromIdx !== toIdx // allow both directions
            ) {
                const div = document.createElement('div');
                div.className = 'busOption';
                div.innerHTML = `<strong>${bus.name}</strong>: ${bus.schedule[fromIdx]} ${bus.stops[fromIdx]} - ${bus.schedule[toIdx]} ${bus.stops[toIdx]}<br>
                    <button type="button">Select</button>`;
                div.querySelector('button').onclick = function () {
                    showSeating(bus.id);
                };
                routesList.appendChild(div);
            } else {
                routesList.innerText = 'No buses available for this route.';
            }
        });
});

function showSeating(busId) {
    const seatingSection = document.getElementById('seatingSection');
    seatingSection.style.display = 'block';
    const seatingChart = document.getElementById('seatingChart');
    seatingChart.innerHTML = 'Loading seats...';
    document.getElementById('bookMsg').innerText = '';
    document.getElementById('selectedSeat').value = '';

    fetch('/api/buses')
        .then(res => res.json())
        .then(buses => {
            const bus = buses.find(b => b.id === busId);
            // Fetch booked seats for this bus and date
            fetch(`/api/bookings/all?bus=${encodeURIComponent(busId)}&date=${encodeURIComponent(date)}`)
                .then(res => res.json())
                .then(allBookings => {
                    const bookedSeats = allBookings.map(b => Number(b.seat)).filter(Boolean);
                    renderSeatingChart(bookedSeats);
                });

            // Attach booking handler
            document.getElementById('bookBtn').onclick = function () {
                const seat = document.getElementById('selectedSeat').value;
                if (!seat) {
                    document.getElementById('bookMsg').innerText = 'Please select a seat.';
                    return;
                }
                const studentId = localStorage.getItem('studentId');
                if (!studentId) {
                    document.getElementById('bookMsg').innerText = 'Please login first.';
                    return;
                }
                fetch('/api/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: studentId,
                        bus: busId,
                        date: date,
                        seat: seat,
                        from: bus.stops[fromIdx],
                        to: bus.stops[toIdx]
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) {
                            document.getElementById('bookMsg').innerText = data.error;
                        } else {
                            document.getElementById('bookMsg').innerText = 'Booking successful!';
                            showSeating(busId); // Refresh seating chart
                        }
                    });
            };
        });
}

// Helper to render seating chart (20 seats, 5 rows x 4 cols)
function renderSeatingChart(bookedSeats = []) {
    const ROWS = 5, COLS = 4;
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