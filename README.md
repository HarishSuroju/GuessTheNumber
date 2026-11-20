# Secret Number Duel

## Run the game

Install Node.js 18 or later, then run:

```sh
npm start
```

Open `http://localhost:3000` in a browser. Local play works on that device. For online play, deploy this Node server to a public host that supports long-lived HTTP connections, then share the deployed HTTPS address with the other player. A static-only website host cannot run the online room server.

## Online room data

Room state is held only in the Node process memory. There is no database. Secret numbers are validated and kept on the server; they are never included in room updates sent to browsers. The winning guess deletes the room immediately. Leaving a room deletes it, waiting rooms expire after 30 minutes, and active games expire after two hours without activity. Restarting the server clears all rooms.
"# GuessTheNumber" 
