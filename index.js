const http = require("http");
const fs = require("fs");
// An increment of the gameID while the script is active. Starts at 0 and increments
// for each game found, in order to keep track of the games
let currentGameID = 0;

// 0 - Inactive :: 1 - Acknowledged :: 2 - Player Info Recorded, Rectangle Data Recording
// Check for status at the end of each card position check. If 0, end loops and start
// getGameResult loop again. If 1, keep looping for card position check.
let gameStatus;

// General information about the player to determine offsets and whatnot.
let playerName;
let opponentName;
let screenDimensions;
let deck;

let cardPositionsOverTime = [];

function main() {
    deck = getActiveDeck();
    // Check for active game
    getGameResult();

    // Game was acknowledged, check to make sure it exists (u never know man)
    // If it does, gameStatus = 2, continue on with data gathering.
    getCardPositions();

    // Request every 5 seconds
    while(gameStatus === 2) {
        getCardPositions();
        setTimeout(5000);
    }

}
main();

let url = "http://localhost:21337/";

// Essentially, check for active game. If there is none, wait 10 seconds and try again.
// If there is one, set currentGameID to data.GameID and go on.
function getGameResult() {
    if(gameStatus === 1) {
        gameStatus = 0;
    } else if(gameStatus === 2) {
        gameStatus = 0;
        parseAndZip();
        return main();
    }
    let data = requestEndpoint("game-result");
    if(data.LocalPlayerWon === null) {
        setTimeout(getGameResult, 10000);
    }
    currentGameID += 1;
    gameStatus = 1;
}

// Check to see if the Player exists. If it doesn't, reset the gameState, then
// loop back to the front of the main function. If the gameStatus has been acknowledged,
// set the player info variables, and begin looping.
function getCardPositions() {
    let data = requestEndpoint("positional-rectangles");
    if(data.PlayerName === null) {
        gameStatus = 0;
        return main();
    }
    if(gameStatus === 1) {
        playerName = data.PlayerName;
        opponentName = data.OpponentName;
        screenDimensions = data.Screen;
        gameStatus = 2;
    }
    cardPositionsOverTime.push(data.Rectangles);
}

function getActiveDeck() {
    return requestEndpoint("static-decklist");
}

function requestEndpoint(endpoint) {
    url += endpoint;
    http.get(url, (res) => {
        let {statusCode} = res;

        if(statusCode !== 200) {
            return 0;
        }

        let data = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => data.join(""));

        return JSON.parse(data);
    });
}

function parseAndZip() {
    let bigBoiData = {
        "playerName": playerName,
        "opponentName": opponentName,
        "screen": screenDimensions,
        "activeDeck": deck,
        "cardPositions": cardPositionsOverTime
    };
    fs.writeFile(`./${currentGameID}.json`, JSON.parse(bigBoiData), () => safeCacheAndShutdown())
}

function safeCacheAndShutdown() {
    let cache = {
        "gameID": currentGameID,
        "port": 21337
    };
    fs.writeFileSync("./cache.json", JSON.parse(cache));
}