var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

var socketID = [];
var snakesPos = [];
var rectColor = [];
const canvasWid = 800;
const canvasHgt = 600;
const objLeng = 20;
var foodX = 0;
var foodY = 0;
function generateFood() {
    foodX = Math.floor(Math.random() * (canvasWid / objLeng)) * objLeng;
    foodY = Math.floor(Math.random() * (canvasHgt / objLeng)) * objLeng;
    while (checkHasSnakeBody(foodX, foodY)) {
        foodX = Math.floor(Math.random() * (canvasWid / objLeng)) * objLeng;
        foodY = Math.floor(Math.random() * (canvasHgt / objLeng)) * objLeng;
    }
}
function checkHasSnakeBody(x, y) {
    let hasTF = false;
    for (let i = 0; i < snakesPos.length; i++){
        for (let j = 0; j < snakesPos[i].rectX.length; j++) {
            if (x === snakesPos[i].rectX[j] && y === snakesPos[i].rectY[j]) {
                hasTF = true;
            }
        }
    }
    return hasTF;
}
function getNoRepeatColor() {
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
        if (rectColor.indexOf(ele) === -1) {
            candidate.push(ele);
        }
    });
    let index = Math.floor(Math.random() * candidate.length);
    return candidate[index];
}
generateFood();
io.on('connection', function (socket) {
    socketID.push(socket.id);
    snakesPos.push({rectX:[0],rectY:[0]});
    socket.emit('init', {id: socket.id, foodX: foodX, foodY: foodY});
    rectColor.push(getNoRepeatColor());
    io.emit('new player', {snakesPos:snakesPos, rectColor: rectColor, foodX:foodX, foodY:foodY,canvasWid:canvasWid,canvasHgt,canvasHgt});
    console.log("id array: " + socketID);
    socket.on('rect move', function (data) {
        let dir = data.direction;
        let id = data.id;
        let resIndex = socketID.indexOf(id);
        let headIndex = snakesPos[resIndex].rectX.length-1;
        let oriHeadX = snakesPos[resIndex].rectX[headIndex];
        let oriHeadY = snakesPos[resIndex].rectY[headIndex];
        let newHeadX = oriHeadX;
        let newHeadY = oriHeadY;
        if (dir === "up") {
            newHeadY = oriHeadY - 20;
            if (newHeadY < 0) {
                socket.emit("you dead",{snakesPos:snakesPos, rectColor: rectColor});
            }
        } else if (dir === "down") {
            newHeadY = oriHeadY + 20;
            if (newHeadY > canvasHgt - objLeng) {
                socket.emit("you dead",{snakesPos:snakesPos, rectColor: rectColor});
            }
        } else if (dir === "left") {
            newHeadX = oriHeadX - 20;
            if (newHeadX < 0) {
                socket.emit("you dead",{snakesPos:snakesPos, rectColor: rectColor});
            }
        } else if (dir === "right") {
            newHeadX = oriHeadX + 20;
            if (newHeadX > canvasWid - objLeng) {
                socket.emit("you dead",{snakesPos:snakesPos, rectColor: rectColor});
            }
        }
        if (checkHasSnakeBody(newHeadX, newHeadY)){
            console.log("you dead");
            for (let i = 0 ; i < snakesPos[resIndex].rectX.length; i++){
                snakesPos[resIndex].rectX[i] = -50;
                snakesPos[resIndex].rectY[i] = -50;
            }
            socket.emit("you dead",{snakesPos:snakesPos, rectColor: rectColor});
        } else {
            snakesPos[resIndex].rectX.push(newHeadX);
            snakesPos[resIndex].rectY.push(newHeadY);
            // 是否有吃到食物
            let eatTF = false;
            for (let i = 0; i < snakesPos[resIndex].rectX.length; i++) {
                if (snakesPos[resIndex].rectX[snakesPos[resIndex].rectX.length - 1] === foodX && snakesPos[resIndex].rectY[snakesPos[resIndex].rectY.length - 1] === foodY) {
                    eatTF = true;
                    generateFood();
                    break;
                }
            }
            if (!eatTF) {
                snakesPos[resIndex].rectX.splice(0, 1);
                snakesPos[resIndex].rectY.splice(0, 1);
            }
            eatTF = false;
            // 是否有有吃到食物
            io.emit('rect move', {snakesPos:snakesPos, rectColor: rectColor,foodX:foodX,foodY:foodY});
            socket.emit('your length', {snakeLeng:snakesPos[resIndex].rectX.length});
        }
    });
    socket.on('disconnect', function () {
        console.log("disconnect");
        console.log(socket.id);
        let resIndex = socketID.indexOf(socket.id);
        socketID.splice(resIndex, 1);
        snakesPos.splice(resIndex, 1);
        rectColor.splice(resIndex, 1);
        console.log(socketID);
        io.emit("player exit", {snakesPos: snakesPos, rectColor: rectColor});
    })
});


http.listen(8080, function () {
    console.log("Listening on : http://localhost:8080");
});