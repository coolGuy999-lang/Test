const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Храним информацию о комнатах: кто хост, кто клиенты
const rooms = {}; 

io.on('connection', (socket) => {
    // 1. Создание комнаты (вызывает первый зашедший игрок — Хост)
    socket.on('create-room', (roomId) => {
        socket.join(roomId);
        rooms[roomId] = { hostId: socket.id, clients: [] };
        console.log(`Комната ${roomId} создана. Хост: ${socket.id}`);
    });

    // 2. Подключение к комнате (локальные игроки)
    socket.on('join-room', (roomId) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            rooms[roomId].clients.push(socket.id);
            // Сообщаем хосту, что зашел новый локальный игрок
            io.to(rooms[roomId].hostId).emit('player-joined', socket.id);
            console.log(`Игрок ${socket.id} зашел в комнату ${roomId}`);
        } else {
            socket.emit('error-msg', 'Комната не найдена');
        }
    });

    // 3. Ретрансляция (Relay): пересылаем всё от игроков к хосту и обратно
    socket.on('send-to-host', ({ roomId, data }) => {
        if (rooms[roomId]) {
            io.to(rooms[roomId].hostId).emit('from-client', { clientId: socket.id, data });
        }
    });

    socket.on('send-to-clients', ({ roomId, data }) => {
        // Хост отправляет обновленное состояние мира всем в комнате
        socket.to(roomId).emit('from-host', data);
    });

    // Очистка при выходе
    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            if (rooms[roomId].hostId === socket.id) {
                io.to(roomId).emit('host-disconnected');
                delete rooms[roomId];
                console.log(`Хост ушел, комната ${roomId} закрыта`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
