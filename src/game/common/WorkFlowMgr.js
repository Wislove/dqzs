// 强制顺序执行(简单版)
import logger from "#utils/logger.js";

export default class WorkFlowMgr {
    constructor() {
        this.queue = [];
        this.sortedQueue = []; // 缓存排序后的队列

        this.priorityDict = {
            "ChopTree": 0,       // 最高优先级
            "Talent": 1,         // 1级项目
            "Invade": 2,         // 2级项目 异兽入侵
            "Challenge": 3,      // 3级项目 ChapterMgr/ SecretTowerMgr / TowerMgr
        };
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new WorkFlowMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        this.queue = [];
        this.sortedQueue = []; // 同时清空已排序的队列
    }

    // 排序并缓存队列
    sortQueue() {
        this.sortedQueue = [...this.queue].sort((a, b) => {
            const priorityA = this.priorityDict[a] ?? Number.MAX_SAFE_INTEGER;
            const priorityB = this.priorityDict[b] ?? Number.MAX_SAFE_INTEGER;
            return priorityA - priorityB;
        });
        logger.debug(`[顺序管理] 排序后的任务队列: ${this.sortedQueue}`);
    }

    async start() {
        // 添加0级项目
        const ChopTree = global.account.switch.chopTree || false;
        if (ChopTree) {
            logger.info("[顺序管理] 已开启砍树");
            this.add("ChopTree");
        }
        // 添加1级项目
        const Talent = global.account.switch.talent || false;
        if (Talent) {
            logger.info("[顺序管理] 已开启砍灵脉");
            this.add("Talent");
        }
        // 添加2级项目
        const Invade = global.account.switch.invade || false;
        if (Invade) {
            logger.info("[顺序管理] 已开启自动异兽入侵");
            this.add("Invade");
        }
        // 添加3级项目
        const challenge = global.account.switch.challenge || 0;
        if (challenge > 0) {
            logger.info("[顺序管理] 已开启自动闯关");
            this.add("Challenge");
        }
    }

    canExecute(t) {
        // 检查排序后的队列是否为空，并判断是否为首位任务
        return this.sortedQueue.length > 0 && this.sortedQueue[0] === t;
    }

    add(name) {
        if (!this.queue.includes(name)) {
            this.queue.push(name);
            this.sortQueue();
        }
    }

    remove(name) {
        this.queue = this.queue.filter(task => task !== name);
        this.sortQueue();
    }
}

// // O(n)
// class PriorityQueue {
//     constructor() {
//         this.queue = [];
//     }

//     enqueue(task, priority) {
//         this.queue.push({ task, priority });
//         this.bubbleUp();
//     }

//     dequeue() {
//         if (this.queue.length === 0) return null;
//         this.swap(0, this.queue.length - 1);
//         const task = this.queue.pop();
//         this.bubbleDown();
//         return task.task;
//     }

//     bubbleUp() {
//         let index = this.queue.length - 1;
//         while (index > 0) {
//             const parentIndex = Math.floor((index - 1) / 2);
//             if (this.queue[index].priority >= this.queue[parentIndex].priority) break;
//             this.swap(index, parentIndex);
//             index = parentIndex;
//         }
//     }

//     bubbleDown() {
//         let index = 0;
//         const length = this.queue.length;
//         while (true) {
//             let left = 2 * index + 1;
//             let right = 2 * index + 2;
//             let swapIndex = null;

//             if (left < length && this.queue[left].priority < this.queue[index].priority) {
//                 swapIndex = left;
//             }

//             if (right < length && this.queue[right].priority < (swapIndex === null ? this.queue[index].priority : this.queue[left].priority)) {
//                 swapIndex = right;
//             }

//             if (swapIndex === null) break;
//             this.swap(index, swapIndex);
//             index = swapIndex;
//         }
//     }

//     swap(i, j) {
//         [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
//     }

//     peek() {
//         return this.queue.length === 0 ? null : this.queue[0].task;
//     }

//     isEmpty() {
//         return this.queue.length === 0;
//     }
// }

// export default class WorkFlowMgr {
//     constructor() {
//         this.priorityDict = {
//             "ChopTree": 0,
//             "Talent": 1,
//             "Invade": 2,
//             "Challenge": 3
//         };

//         this.queue = new PriorityQueue();
//     }

//     add(task) {
//         if (!this.queue.peek(task)) {
//             const priority = this.priorityDict[task] ?? Number.MAX_SAFE_INTEGER;
//             this.queue.enqueue(task, priority);
//         }
//     }

//     canExecute(task) {
//         return this.queue.peek() === task;
//     }

//     remove(task) {
//         if (this.queue.peek() === task) {
//             this.queue.dequeue();
//         }
//     }

//     clear() {
//         this.queue = new PriorityQueue();
//     }
// }
