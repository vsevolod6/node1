const zmq = require('zeromq');

class GameClient {
    constructor(min, max) {
        this.min = parseInt(min);
        this.max = parseInt(max);
        this.secretNumber = this.generateSecretNumber();
        this.socket = null;
        this.serverAttempts = 0;
    }

    generateSecretNumber() {
        return Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    }

    async start() {
        try {
            // Проверяем валидность диапазона
            if (this.min >= this.max) {
                throw new Error('Неверный диапазон: минимальное число должно быть меньше максимального');
            }

            console.log(`Загадано число в диапазоне ${this.min}-${this.max}`);
            console.log(`Загаданное число: ${this.secretNumber} (для отладки)`);

            // Создаем REQ (Request) сокет для подключения к серверу
            this.socket = new zmq.Request();
            this.socket.connect('tcp://localhost:5555');

            // Отправляем начальное сообщение с диапазоном
            await this.sendRange();

            // Основной цикл игры
            await this.playGame();

        } catch (error) {
            console.error('Ошибка клиента:', error);
        } finally {
            if (this.socket) {
                this.socket.close();
            }
        }
    }

    async sendRange() {
        const message = { range: `${this.min}-${this.max}` };
        console.log('Отправляю диапазон серверу:', message);
        await this.socket.send(JSON.stringify(message));
    }

    async playGame() {
        while (true) {
            // Ждем ответ от сервера
            const [response] = await this.socket.receive();
            const message = JSON.parse(response.toString());
            
            this.serverAttempts++;
            console.log(`Попытка ${this.serverAttempts}: Сервер предположил: ${message.answer}`);

            // Проверяем ответ сервера
            if (message.answer === this.secretNumber) {
                console.log('🎉 Сервер угадал число!');
                await this.sendHint('correct');
                console.log(`Игра завершена. Количество попыток: ${this.serverAttempts}`);
                break;
            } else if (message.answer < this.secretNumber) {
                console.log(`Серверу нужно предложить число БОЛЬШЕ чем ${message.answer}`);
                await this.sendHint('more');
            } else {
                console.log(`Серверу нужно предложить число МЕНЬШЕ чем ${message.answer}`);
                await this.sendHint('less');
            }

            // Добавляем небольшую задержку для наглядности
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async sendHint(hint) {
        const message = { hint: hint };
        console.log('Отправляю подсказку серверу:', message);
        await this.socket.send(JSON.stringify(message));
    }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);

if (args.length !== 2) {
    console.log('Использование: node game-client.js <min> <max>');
    console.log('Пример: node game-client.js 1 100');
    process.exit(1);
}

const [min, max] = args;

// Запуск клиента
const client = new GameClient(min, max);
client.start().catch(console.error);