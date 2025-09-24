const zmq = require('zeromq');

class GameServer {
    constructor() {
        this.socket = null;
        this.currentRange = null;
        this.min = 0;
        this.max = 0;
        this.currentGuess = 0;
        this.attempts = 0;
    }

    async start() {
        try {
            // Создаем REP (Reply) сокет для ответов клиенту
            this.socket = new zmq.Reply();
            
            // Привязываем сокет к адресу
            await this.socket.bind('tcp://*:5555');
            console.log('Готов к игре...');
            console.log('Ожидаю подключения клиента на tcp://localhost:5555');

            // Основной цикл обработки сообщений
            while (true) {
                const [message] = await this.socket.receive();
                await this.handleMessage(JSON.parse(message.toString()));
            }
        } catch (error) {
            console.error('Ошибка сервера:', error);
        }
    }

    async handleMessage(message) {
        console.log('Получено от клиента:', message);

        if (message.range) {
            // Обработка начального сообщения с диапазоном
            await this.handleRangeMessage(message);
        } else if (message.hint) {
            // Обработка подсказки от клиента
            await this.handleHintMessage(message);
        } else {
            // Неизвестное сообщение
            await this.sendResponse({ error: 'Неизвестный формат сообщения' });
        }
    }

    async handleRangeMessage(message) {
        const [min, max] = message.range.split('-').map(Number);
        this.min = min;
        this.max = max;
        this.currentRange = { min, max };
        this.attempts = 0;

        console.log(`Клиент загадал число в диапазоне: ${min}-${max}`);
        
        // Делаем первую попытку угадать (середина диапазона)
        this.currentGuess = Math.floor((min + max) / 2);
        await this.sendGuess();
    }

    async handleHintMessage(message) {
        this.attempts++;

        if (message.hint === 'more') {
            console.log(`Попытка ${this.attempts}: ${this.currentGuess} - нужно БОЛЬШЕ`);
            this.min = this.currentGuess + 1;
        } else if (message.hint === 'less') {
            console.log(`Попытка ${this.attempts}: ${this.currentGuess} - нужно МЕНЬШЕ`);
            this.max = this.currentGuess - 1;
        } else if (message.hint === 'correct') {
            console.log(`🎉 Угадал число ${this.currentGuess} за ${this.attempts} попыток!`);
            await this.sendResponse({ result: 'win', attempts: this.attempts, number: this.currentGuess });
            return;
        }

        // Проверяем, не сузили ли мы диапазон до одного числа
        if (this.min === this.max) {
            this.currentGuess = this.min;
            console.log(`Достигнут минимальный диапазон. Предполагаю число: ${this.currentGuess}`);
            await this.sendGuess();
            return;
        }

        // Проверяем валидность диапазона
        if (this.min > this.max) {
            console.log('Ошибка: диапазон стал невалидным. Возможно клиент предоставляет противоречивые подсказки.');
            await this.sendResponse({ error: 'Невалидный диапазон' });
            return;
        }

        // Делаем следующее предположение (бинарный поиск)
        this.currentGuess = Math.floor((this.min + this.max) / 2);
        await this.sendGuess();
    }

    async sendGuess() {
        const response = { answer: this.currentGuess };
        console.log(`Отправляю предположение: ${this.currentGuess}`);
        await this.sendResponse(response);
    }

    async sendResponse(response) {
        await this.socket.send(JSON.stringify(response));
    }
}

// Запуск сервера
const server = new GameServer();
server.start().catch(console.error);