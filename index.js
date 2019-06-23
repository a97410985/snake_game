var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var roomInfoList = [];
var ID_and_room = [];
var ID_and_nickname = [];

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

class SnakeGame {
    constructor(canvasWid, canvasHgt, objLeng, foodNum) {
        this.snakeID = [];
        this.snakesPos = [];
        this.rectColor = [];
        this.canvasWid = canvasWid;
        this.canvasHgt = canvasHgt;
        this.objLeng = objLeng;
        this.foodNum = foodNum;
        this.foodsX = [];
        this.foodsY = [];
        for (let i = 0; i < this.foodNum; i++) {
            let emptyPos = this.getEmptySpace();
            this.foodsX.push(emptyPos.x);
            this.foodsY.push(emptyPos.y);
        }
    }

    checkHasSnakeBody(x, y) {
        let hasTF = false;
        for (let i = 0; i < this.snakesPos.length; i++) {
            for (let j = 0; j < this.snakesPos[i].rectX.length; j++) {
                if (x === this.snakesPos[i].rectX[j] && y === this.snakesPos[i].rectY[j]) {
                    hasTF = true;
                }
            }
        }
        return hasTF;
    }

    checkHasFood(x,y){
        let hasTF = false;
        for (let i = 0 ; i < this.foodNum ; i++){
            if (this.foodsX[i] === x && this.foodsY[i] === y){
                hasTF = true;
                break;
            }
        }
        return hasTF;
    }

    getEmptySpace() {
        let pos = {x: 0, y: 0};
        pos.x = Math.floor(Math.random() * (this.canvasWid / this.objLeng)) * this.objLeng;
        pos.y = Math.floor(Math.random() * (this.canvasHgt / this.objLeng)) * this.objLeng;
        while (this.checkHasSnakeBody(pos.x, pos.y) || this.checkHasFood(pos.x,pos.y)) {
            pos.x = Math.floor(Math.random() * (this.canvasWid / this.objLeng)) * this.objLeng;
            pos.y = Math.floor(Math.random() * (this.canvasHgt / this.objLeng)) * this.objLeng;
        }
        return pos;
    }

    getNoRepeatColor() {
        var _this = this;
        let color = [];
        color.push("#9d9d9d");
        color.push("#ff0000");
        color.push("#ff60af");
        color.push("#ff44ff");
        color.push("#b15bff");
        color.push("#4a4aff");
        color.push("#0080ff");
        color.push("#00e3e3");
        color.push("#02f78e");
        color.push("#00ec00");
        let candidate = [];
        color.forEach(function (ele) {
            if (_this.rectColor.indexOf(ele) === -1) {
                candidate.push(ele);
            }
        });
        let index = Math.floor(Math.random() * candidate.length);
        return candidate[index];
    }
}

function deletePlayerGameInfo(socket, nickName) {
    console.log("before leave room", "ID_and_room", ID_and_room);
    let index = ID_and_room.findIndex(function (ele) {
        return ele.id === socket.id;
    });
    let roomName = ID_and_room[index].roomName;
    ID_and_room.splice(index, 1);
    console.log("after leave room", "ID_and_room", ID_and_room);
    let i = roomInfoList.findIndex(function (ele) {
        return roomName === ele.roomName;
    });
    roomInfoList[i].curCapacity -= 1;
    /*  將其在貪吃蛇遊戲的資訊刪除 */
    if (roomInfoList[i].curCapacity === 0) {
        roomInfoList.splice(i,1);
    } else {
        let curGame = roomInfoList[i].snakeGame;
        let resIndex = curGame.snakeID.indexOf(socket.id);
        curGame.snakeID.splice(resIndex, 1);
        curGame.snakesPos.splice(resIndex, 1);
        curGame.rectColor.splice(resIndex, 1);

        socket.to(roomName).emit("user exit", {
            nickName: nickName,
            curCapacity: roomInfoList[i].curCapacity,
            snakesPos: curGame.snakesPos,
            rectColor: curGame.rectColor,
            foodsX: curGame.foodsX,
            foodsY: curGame.foodsY,
            foodNum: curGame.foodNum
        });
        // 要離開房間
        socket.leave(roomName);
        let nickNameAndColorList = getNickNameAndColorList(curGame);
        io.to(roomName).emit('update nickname-color list', nickNameAndColorList);
    }
    io.emit("room info update", {roomInfoList: roomInfoList});
}

function getNickNameAndColorList(game) {
    let list = [];
    let i = 0;
    game.snakeID.forEach(function (id) {
        ID_and_nickname.forEach(function (id_nickName) {
            if (id_nickName.id === id) {
                let nickName = id_nickName.nickName;
                let color = game.rectColor[i];
                list.push({nickName: nickName, color: color});
            }
        });
        i++;
    });
    return list;
}

function joinRoom(socket, data, index) {
    socket.join(data.roomName);
    ID_and_room.push({id: socket.id, roomName: data.roomName});
    roomInfoList[index].curCapacity += 1;
    let curGame = roomInfoList[index].snakeGame;
    curGame.snakeID.push(socket.id);
    let emptyPos = curGame.getEmptySpace();
    let rx = emptyPos.x;
    let ry = emptyPos.y;
    curGame.snakesPos.push({rectX: [rx], rectY: [ry]});
    curGame.rectColor.push(curGame.getNoRepeatColor());
    io.to(data.roomName).emit('new player', {
        snakesPos: curGame.snakesPos,
        rectColor: curGame.rectColor,
        foodsX: curGame.foodsX,
        foodsY: curGame.foodsY,
        foodNum: curGame.foodNum,
        canvasWid: curGame.canvasWid,
        canvasHgt: curGame.canvasHgt
    });
    io.emit("room info update", {roomInfoList: roomInfoList});
    socket.emit("join room response", {
        success: true,
        roomInfo: roomInfoList[index],
    });
    data.curCapacity = roomInfoList[index].curCapacity;
    let pos = curGame.snakeID.indexOf(socket.id);
    data.snakeColor = curGame.rectColor[pos];
    io.to(data.roomName).emit('add user', data);
    socket.emit('init', {
        id: socket.id,
        foodsX: curGame.foodsX,
        foodsY: curGame.foodsY,
        foodNum: curGame.foodNum,
        snakesPos: curGame.snakesPos,
        rectColor: curGame.rectColor
    });
    let nickNameAndColorList = getNickNameAndColorList(curGame);
    io.to(data.roomName).emit('update nickname-color list', nickNameAndColorList)
}

io.on('connection', function (socket) {
    io.emit("room info update", {roomInfoList: roomInfoList});
    socket.on("create room request", function (data) {
        if (roomInfoList.findIndex(function (roomInfo) {
            return data.room.roomName === roomInfo.roomName;
        }) === -1) {
            data.room.snakeGame = new SnakeGame(data.room.roomWid * data.room.snakeSize, data.room.roomHgt * data.room.snakeSize, data.room.snakeSize,data.room.foodNum);
            roomInfoList.push(data.room);
            socket.emit("create room response", {success: true, snakeSize: data.room.snakeSize});
            data.room.nickName = data.nickName;
            joinRoom(socket, data.room, roomInfoList.length - 1);
            io.emit("room info update", {roomInfoList: roomInfoList});
        } else {
            socket.emit("create room response", {success: false});
        }
    });
    socket.on("join room request", function (data) {
        let index = roomInfoList.findIndex(function (roominfo) {
            return data.roomName === roominfo.roomName;
        });
        // 看看是否需要密碼
        if (index === -1){
            socket.emit("join room response", {success: false, roomName: data.roomName});
        }
        else if (roomInfoList[index].curCapacity >= roomInfoList[index].roomCapacity) {
            socket.emit("join room response", {success: false, roomName: data.roomName});
        } else if (roomInfoList[index].password !== "") {
            socket.emit("type password", {roomName: data.roomName});
        } else {
            let id = socket.id;
            if (roomInfoList[index].curCapacity < roomInfoList[index].roomCapacity) {
                joinRoom(socket, data, index);
            }
        }
    });
    socket.on("join room with password", function (data) {
        let index = roomInfoList.findIndex(function (roominfo) {
            return data.roomName === roominfo.roomName;
        });
        if (index !== -1){
            if (roomInfoList[index].curCapacity >= roomInfoList[index].roomCapacity || data.password !== roomInfoList[index].password) {
                socket.emit("join room response", {success: false, roomName: data.roomName});
            } else {
                let id = socket.id;
                if (roomInfoList[index].curCapacity < roomInfoList[index].roomCapacity) {
                    joinRoom(socket, data, index);
                }
            }
        }else{
            socket.emit("join room response", {success: false, roomName: data.roomName});
        }
    });
    socket.on('chat message', function (data) {
        socket.to(data.roomName).emit('chat message', data);  // may has problem
    });
    socket.on("add nickname", function (data) {
        ID_and_nickname.push({id: socket.id, nickName: data.nickName});
        console.log("ID_and_nickname", ID_and_nickname);
    });
    socket.on("disconnect", function () {
        let index = ID_and_nickname.findIndex(function (ele) {
            return ele.id === socket.id;
        });
        if (index !== -1){
            let curNickName = ID_and_nickname[index].nickName;
            // 斷線的時候可能在大廳也可能在房間，如果在房間
            let i = ID_and_room.findIndex(function (ele) {
                return ele.id === socket.id;
            });
            if (i !== -1) {
                deletePlayerGameInfo(socket, curNickName);
            }
            ID_and_nickname.splice(index, 1);
            /* todo: 可能有問題*/
        }

    });
    socket.on("leave room", function (data) {
        deletePlayerGameInfo(socket, data.nickName);
    });

    /*  snake game */
    socket.on('rect move', function (data) {
        let index = ID_and_room.findIndex(function (ele) {
            return ele.id === socket.id;
        });
        if (index !== -1) {
            let curRoomName = ID_and_room[index].roomName;
            index = roomInfoList.findIndex(function (ele) {
                return ele.roomName === curRoomName;
            });

            let curGame = roomInfoList[index].snakeGame;
            let dir = data.direction;
            let id = socket.id;
            let resIndex = curGame.snakeID.indexOf(id);
            let headIndex = curGame.snakesPos[resIndex].rectX.length - 1;
            let oriHeadX = curGame.snakesPos[resIndex].rectX[headIndex];
            let oriHeadY = curGame.snakesPos[resIndex].rectY[headIndex];
            let newHeadX = oriHeadX;
            let newHeadY = oriHeadY;
            let leng = parseInt(curGame.objLeng);
            if (dir === "up") {
                newHeadY = oriHeadY - leng;
                if (newHeadY < 0) {
                    socket.emit("you dead", {snakesPos: curGame.snakesPos, rectColor: curGame.rectColor});
                }
            } else if (dir === "down") {
                newHeadY = oriHeadY + leng;
                if (newHeadY > curGame.canvasHgt - leng) {
                    socket.emit("you dead", {snakesPos: curGame.snakesPos, rectColor: curGame.rectColor});
                }
            } else if (dir === "left") {
                newHeadX = oriHeadX - leng;
                if (newHeadX < 0) {
                    socket.emit("you dead", {snakesPos: curGame.snakesPos, rectColor: curGame.rectColor});
                }
            } else if (dir === "right") {
                newHeadX = oriHeadX + leng;
                if (newHeadX > curGame.canvasWid - leng) {
                    socket.emit("you dead", {snakesPos: curGame.snakesPos, rectColor: curGame.rectColor});
                }
            }
            if (curGame.checkHasSnakeBody(newHeadX, newHeadY)) {
                for (let i = 0; i < curGame.snakesPos[resIndex].rectX.length; i++) {
                    curGame.snakesPos[resIndex].rectX[i] = -50;
                    curGame.snakesPos[resIndex].rectY[i] = -50;
                }
                socket.emit("you dead", {snakesPos: curGame.snakesPos, rectColor: curGame.rectColor});
            } else {
                curGame.snakesPos[resIndex].rectX.push(newHeadX);
                curGame.snakesPos[resIndex].rectY.push(newHeadY);
                // 是否有吃到食物
                let eatTF = false; // test
                for (let i = 0; i < curGame.snakesPos[resIndex].rectX.length; i++) {
                    for (let j = 0 ; j < curGame.foodNum ; j++){
                        if (newHeadX === curGame.foodsX[j] && newHeadY === curGame.foodsY[j]) {
                            eatTF = true;
                            let emptyPos = curGame.getEmptySpace();
                            curGame.foodsX[j] = emptyPos.x;
                            curGame.foodsY[j] = emptyPos.y;
                            break;
                        }
                    }
                }
                if (!eatTF) {
                    curGame.snakesPos[resIndex].rectX.splice(0, 1);
                    curGame.snakesPos[resIndex].rectY.splice(0, 1);
                }
                eatTF = false;
                // 是否有有吃到食物
                io.to(curRoomName).emit('rect move', {
                    snakesPos: curGame.snakesPos,
                    rectColor: curGame.rectColor,
                    foodsX: curGame.foodsX,
                    foodsY: curGame.foodsY,
                    foodNum: curGame.foodNum
                });
                socket.emit('your length', {snakeLeng: curGame.snakesPos[resIndex].rectX.length});
            }
        }
    });
    socket.on("revive request", function () {
        let index = ID_and_room.findIndex(function (id_room) {
            return id_room.id === socket.id;
        });
        let curRoomName = ID_and_room[index].roomName;
        index = roomInfoList.findIndex(function (room) {
            return room.roomName === curRoomName;
        });
        let curGame = roomInfoList[index].snakeGame;
        index = curGame.snakeID.indexOf(socket.id);
        let emptyPos = curGame.getEmptySpace();
        curGame.snakesPos[index] = {rectX: [emptyPos.x], rectY: [emptyPos.y]};
        socket.emit("revive", {
            snakesPos: curGame.snakesPos,
            rectColor: curGame.rectColor,
            foodsX: curGame.foodsX,
            foodsY: curGame.foodsY,
            foodNum: curGame.foodNum
        });
    });
});

const server = http.listen(process.env.PORT || 8080, function () {
    console.log("http://localhost:" + server.address().port);
});