// deno-lint-ignore-file no-explicit-any
import { EventEmitter } from './deps.ts'
import { printLog, printErr } from './utils/mod.ts'
import { config } from './config.ts'
import { db } from './db.ts'

try {
    await db.execute("CREATE TABLE IF NOT EXISTS `danmaku` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT , `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , `uid` BIGINT UNSIGNED NOT NULL , `nickname` VARCHAR(255) NOT NULL , `medal_name` VARCHAR(255), `medal_level` INT, `room` BIGINT UNSIGNED NOT NULL , `text` VARCHAR(255) NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB; ")
    await db.execute("CREATE TABLE IF NOT EXISTS `event` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT , `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , `uid` BIGINT UNSIGNED NOT NULL , `nickname` VARCHAR(255) NOT NULL , `room` BIGINT UNSIGNED NOT NULL, `type` INT NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB; ")
    await db.execute("CREATE TABLE IF NOT EXISTS `superchat` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT , `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , `uid` BIGINT UNSIGNED NOT NULL , `nickname` VARCHAR(255) NOT NULL , `room` BIGINT UNSIGNED NOT NULL , `price` INT NOT NULL , `text` TEXT NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB; ")
    await db.execute("CREATE TABLE IF NOT EXISTS `gift` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT , `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , `uid` BIGINT UNSIGNED NOT NULL , `nickname` TEXT NOT NULL , `room` BIGINT UNSIGNED NOT NULL, `price` DOUBLE UNSIGNED NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;")
    await db.execute("CREATE TABLE IF NOT EXISTS `guard` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT , `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , `uid` BIGINT UNSIGNED NOT NULL , `nickname` VARCHAR(255) NOT NULL , `room` BIGINT UNSIGNED NOT NULL , `type` VARCHAR(255) NOT NULL , PRIMARY KEY (`id`)) ENGINE = InnoDB;")
} catch (e) {
    printErr('全局弹幕监视', '初始化数据库失败')
}
const danmakuEvent = new EventEmitter()
const websocket = new WebSocket(`ws://127.0.0.1:${config.apiPort}`)

interface IMessage {
    cmd: string
    room: number
    data: any
}

websocket.addEventListener('open', () => {
    printLog('全局弹幕监视', '连接到框架')
})

websocket.addEventListener('message', (event) => {
    const data: IMessage = JSON.parse(event.data)
    danmakuEvent.emit(data.cmd, data.room, data.data)
})

danmakuEvent.on('ROOM_BLOCK_MSG', (room: number, msg: any) => {
    printLog('全局弹幕监视', `房间${room}禁言了 ${msg['uname']} UID:${msg['uid']}`)
    db.execute("INSERT INTO `event`(`room`, `uid`, `nickname`, `type`) VALUES (?,?,?,?)", [room, msg['uid'], msg['uname'], 1])
        .catch((err) => {
            printErr('全局弹幕监视', '写事件日志失败')
            printErr('全局弹幕监视', err)
        })
})
danmakuEvent.on('INTERACT_WORD', (room: number, msg: any) => {
    printLog('全局弹幕监视', `用户${msg['uname']} UID: ${msg['uid']} 进入了房间 ${room}`)
    db.execute("INSERT INTO `event`(`room`, `uid`, `nickname`, `type`) VALUES (?,?,?,?)", [room, msg['uid'], msg['uname'], 0])
        .catch((err) => {
            printErr('全局弹幕监视', '写事件日志失败')
            printErr('全局弹幕监视', err)
        })
})
danmakuEvent.on('DANMU_MSG', (room: number, msg: Array<any>) => {
    printLog('全局弹幕监视', `用户${msg[2][1]} ${msg[3][1]}:${msg[3][0]} UID:${msg[2][0]} 在房间 ${room} 发送弹幕: ${msg[1]}`)
    db.execute("INSERT INTO `danmaku`(`room`, `uid`, `nickname`, `text`, `medal_name`, `medal_level`) VALUES (?,?,?,?,?,?)", [room, msg[2][0], msg[2][1], msg[1], msg[3][1], msg[3][0]])
        .catch((err) => {
            printErr('全局弹幕监视', '写弹幕日志失败')
            printErr('全局弹幕监视', err)
        })
})
danmakuEvent.on('SUPER_CHAT_MESSAGE', (room: number, msg: any) => {
    printLog('全局弹幕监视', `用户${msg['user_info']['uname']} UID:${msg['uid']} 在房间 ${room} 发送 ${msg['price']}元SC: ${msg['message']}`)
    db.execute("INSERT INTO `superchat`(`room`, `uid`, `nickname`, `text`, `price`) VALUES (?,?,?,?,?)", [room, msg['uid'], msg['user_info']['uname'], msg['message'], msg['price']])
        .catch((err) => {
            printErr('全局弹幕监视', '写醒目留言日志失败')
            printErr('全局弹幕监视', err)
        })
})
danmakuEvent.on('SEND_GIFT', (room: number, msg: any) => {
    printLog('全局弹幕监视', `${msg['uname']} 投喂了${msg['super_gift_num']}个 ${msg['giftName']} 价值${msg['price'] / 1000 * msg['super_gift_num']}元\n`)
    db.execute("INSERT INTO `gift`(`room`, `uid`, `nickname`, `price`) VALUES (?,?,?,?)", [room, msg['uid'], msg['uname'], msg['price'] / 1000 * msg['super_gift_num']])
        .catch((err) => {
            printErr('全局弹幕监视', '写礼物日志失败')
            printErr('全局弹幕监视', err)
        })
})
danmakuEvent.on('GUARD_BUY', (room: number, msg: any) => {
    printLog('全局弹幕监视', `${msg['username']}:${msg['uid']} 购买了 ${msg['gift_name']}`)
    db.execute("INSERT INTO `guard`(`room`, `uid`, `nickname`, `type`) VALUES (?,?,?,?)", [room, msg['uid'], msg['username'], msg['gift_name']])
        .catch((err) => {
            printErr('全局弹幕监视', '写舰长日志失败')
            printErr('全局弹幕监视', err)
        })
})