const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
let latestLocations = {}; // { busId: {lat, lng, time} }

function to24Hour(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

const app = express();
app.use(express.static('public'));
const db = new sqlite3.Database('./bus_booking.db');

const bookingQueue = [];
let processingBooking = false;

function processBookingQueue() {
    if (processingBooking || bookingQueue.length === 0) return;
    processingBooking = true;
    const { req, res } = bookingQueue.shift();
    const { student_id, bus, date, seat, from, to } = req.body;

    // Check for any future bookings for this student (AGAIN, inside the queue processor)
    db.all('SELECT * FROM bookings WHERE student_id = ?', [student_id], (err, rows) => {
        if (err) {
            processingBooking = false;
            res.status(500).json({ error: err.message });
            processBookingQueue();
            return;
        }

        const hasActive = rows.some(row => {
            const bookedBus = buses.find(b => b.id === row.bus);
            if (!bookedBus) return false;
            const bookedToIdx = bookedBus.stops.indexOf(row.to_stop);
            if (bookedToIdx === -1) return false;
            const bookedEndTime = bookedBus.schedule[bookedToIdx];
            const bookedEndDateTime = new Date(`${row.date}T${to24Hour(bookedEndTime)}`);
            return bookedEndDateTime >= new Date();
        });

        if (hasActive) {
            processingBooking = false;
            res.status(400).json({ error: 'You already have an active booking. You can only book one bus at a time until your ride has passed.' });
            processBookingQueue();
            return;
        }

        // Now check if the seat is already booked
        db.get('SELECT * FROM bookings WHERE bus = ? AND date = ? AND seat = ?', [bus, date, seat], (err, row) => {
            if (row) {
                processingBooking = false;
                res.status(400).json({ error: 'Seat already booked.' });
                processBookingQueue();
                return;
            }
            db.run(
                'INSERT INTO bookings (student_id, bus, date, seat, from_stop, to_stop) VALUES (?, ?, ?, ?, ?, ?)',
                [student_id, bus, date, seat, from, to],
                function (err) {
                    processingBooking = false;
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.json({ success: true, bookingId: this.lastID });
                    }
                    processBookingQueue();
                }
            );
        });
    });
}

app.post('/api/gps', (req, res) => {
    const { busId, lat, lng } = req.body;
    if (!busId || !lat || !lng) return res.status(400).json({ error: 'Missing data' });
    latestLocations[busId] = { lat, lng, time: Date.now() };
    res.json({ success: true });
});

app.get('/api/gps/:busId', (req, res) => {
    const loc = latestLocations[req.params.busId];
    if (!loc) return res.status(404).json({ error: 'No location' });
    res.json(loc);
});

app.use(cors());
app.use(bodyParser.json());

// Create tables
// filepath: /home/presenc6/projects/test/bus-booking-system/backend/app.js
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        password TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    bus TEXT NOT NULL,
    date TEXT NOT NULL,
    seat INTEGER NOT NULL,
    from_stop TEXT,
    to_stop TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id)
)`);
    
});

const buses = [
    {
        id: 'bus1',
        name: 'Campus Express',
        time: '08:00 AM',
        stops: [
            'BUP', 'Stop A', 'Stop B', 'Stop C', 'Stop B', 'Stop A', 'BUP'
        ],
        schedule: [
            '08:00 AM', // BUP
            '08:15 AM', // Stop A
            '08:30 AM', // Stop B
            '08:45 AM', // Stop C
            '09:00 AM', // Stop B (return)
            '09:15 AM', // Stop A (return)
            '09:30 AM'  // BUP (return)
        ]
    },
    {
        id: 'bus2',
        name: 'City Shuttle',
        time: '09:30 AM',
        stops: [
            'BUP', 'Stop D', 'Stop E', 'Stop F', 'Stop E', 'Stop D', 'BUP'
        ],
        schedule: [
            '09:30 AM', // BUP
            '09:45 AM', // Stop D
            '10:00 AM', // Stop E
            '10:15 AM', // Stop F
            '10:30 AM', // Stop E (return)
            '10:45 AM', // Stop D (return)
            '11:00 AM'  // BUP (return)
        ]
    },
    {
        id: 'bus3',
        name: 'North Loop',
        time: '11:00 AM',
        stops: [
            'BUP', 'Stop G', 'Stop H', 'Stop I', 'Stop H', 'Stop G', 'BUP'
        ],
        schedule: [
            '11:00 AM', // BUP
            '11:20 AM', // Stop G
            '11:40 AM', // Stop H
            '12:00 PM', // Stop I
            '12:20 PM', // Stop H (return)
            '12:40 PM', // Stop G (return)
            '13:00 PM'  // BUP (return)
        ]
    },
    {
        id: 'bus4',
        name: 'South Loop',
        time: '01:00 PM',
        stops: [
            'BUP', 'Stop J', 'Stop K', 'Stop L', 'Stop K', 'Stop J', 'BUP'
        ],
        schedule: [
            '01:00 PM', // BUP
            '01:15 PM', // Stop J
            '01:30 PM', // Stop K
            '01:45 PM', // Stop L
            '02:00 PM', // Stop K (return)
            '02:15 PM', // Stop J (return)
            '02:30 PM'  // BUP (return)
        ]
    },
    {
        id: 'bus5',
        name: 'Evening Express',
        time: '03:30 PM',
        stops: [
            'BUP', 'Stop M', 'Stop N', 'Stop O', 'Stop N', 'Stop M', 'BUP'
        ],
        schedule: [
            '03:30 PM', // BUP
            '03:45 PM', // Stop M
            '04:00 PM', // Stop N
            '04:15 PM', // Stop O
            '04:30 PM', // Stop N (return)
            '04:45 PM', // Stop M (return)
            '05:00 PM'  // BUP (return)
        ]
    },
    {
        id: 'bus6',
        name: 'Late Shuttle',
        time: '05:30 PM',
        stops: [
            'BUP', 'Stop P', 'Stop Q', 'Stop R', 'Stop Q', 'Stop P', 'BUP'
        ],
        schedule: [
            '05:30 PM', // BUP
            '05:45 PM', // Stop P
            '06:00 PM', // Stop Q
            '06:15 PM', // Stop R
            '06:30 PM', // Stop Q (return)
            '06:45 PM', // Stop P (return)
            '07:00 PM'  // BUP (return)
        ]
    }
];

// Endpoint to get all buses
app.get('/api/buses', (req, res) => {
    res.json(buses);
});

app.post('/api/register', (req, res) => {
    const { id, password } = req.body;
    // Only allow s001-s100
    if (!/^s(0[0-9][1-9]|0[1-9][0-9]|100)$/.test(id)) {
        return res.status(400).json({ error: 'Student ID must be from s001 to s100.' });
    }
    if (!password) {
        return res.status(400).json({ error: 'Password required.' });
    }
    db.run('INSERT INTO students (id, password) VALUES (?, ?)', [id, password], function (err) {
        if (err) {
            return res.status(400).json({ error: 'Student ID already exists.' });
        }
        res.json({ success: true });
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    if (!/^s(0[0-9][1-9]|0[1-9][0-9]|100)$/.test(id)) {
        return res.status(400).json({ error: 'Invalid student ID format.' });
    }
    db.get('SELECT * FROM students WHERE id = ? AND password = ?', [id, password], (err, row) => {
        if (row) {
            res.json({ success: true, id });
        } else {
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    });
});

// Book bus endpoint
app.post('/api/book', (req, res) => {
    const { student_id, bus, date, seat, from, to } = req.body;
    if (!student_id || !bus || !date || !seat || !from || !to) {
        return res.status(400).json({ error: 'Missing booking data.' });
    }

    // Find the bus object to get the schedule
    const busObj = buses.find(b => b.id === bus);
    if (!busObj) {
        return res.status(400).json({ error: 'Invalid bus.' });
    }
    const toIdx = busObj.stops.indexOf(to);
    if (toIdx === -1) {
        return res.status(400).json({ error: 'Invalid stop.' });
    }

    // Check for any future bookings for this student (across all buses)
    db.all('SELECT * FROM bookings WHERE student_id = ?', [student_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const hasActive = rows.some(row => {
            const bookedBus = buses.find(b => b.id === row.bus);
            if (!bookedBus) return false;
            const bookedToIdx = bookedBus.stops.indexOf(row.to_stop);
            if (bookedToIdx === -1) return false;
            const bookedEndTime = bookedBus.schedule[bookedToIdx];
            const bookedEndDateTime = new Date(`${row.date}T${to24Hour(bookedEndTime)}`);
            return bookedEndDateTime >= new Date();
        });

        if (hasActive) {
            return res.status(400).json({ error: 'You already have an active booking. You can only book one bus at a time until your ride has passed.' });
        }

        // Check if student already has a booking for this bus/date/from/to (optional, for clearer error)
        db.get(
            'SELECT * FROM bookings WHERE student_id = ? AND bus = ? AND date = ? AND from_stop = ? AND to_stop = ?',
            [student_id, bus, date, from, to],
            (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row) {
                    return res.status(400).json({ error: 'You have already booked a seat on this bus for this trip.' });
                }
                // If no active booking, proceed as before
                bookingQueue.push({ req, res });
                processBookingQueue();
            }
        );
    });
});

// Get bookings for student
app.get('/api/bookings/:student_id', (req, res) => {
    db.all('SELECT * FROM bookings WHERE student_id = ?', [req.params.student_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/bookings/all', (req, res) => {
    const { bus, date } = req.query;
    console.log('Fetching bookings for:', bus, date); // Add this line
    db.all('SELECT * FROM bookings WHERE bus = ? AND date = ?', [bus, date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3001, () => console.log('Backend running on http://localhost:3001'));

app.delete('/api/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    db.run('DELETE FROM bookings WHERE id = ?', [bookingId], function (err) {
        if (err) {
            res.status(500).json({ error: 'Failed to cancel booking.' });
        } else {
            res.json({ success: true });
        }
    });
});