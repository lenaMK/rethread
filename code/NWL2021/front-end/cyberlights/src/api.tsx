import { io, Socket } from "socket.io-client";
import { DefaultEventsMap } from "socket.io-client/build/typed-events";
import { IEmoji, IUserPersonalScore, IUserScore, laureateI } from "./types";

//Socket communication
export const socket: Socket<DefaultEventsMap, DefaultEventsMap> = io("/control");

window.addEventListener("click", (ev) => {
    socket.emit("click", { "x": ev.clientX, "y": ev.clientY })
})

//LAUREATES API
export const getLaureates = (): Promise<laureateI[]> => {
    const url = `/api/laureates`;
    return getRequest(url)
}

//LAUREATES API
export const getLaureate = (laureateID: string): Promise<laureateI> => {
    const url = `/api/laureates/` + laureateID;
    return getRequest(url)
}
//Emoji API
export const getEmojis = async (): Promise<[IEmoji]> => {
    const url = `/api/emojis/`;
    return getRequest(url)
}
//SCORE API
export const getScore = async (): Promise<[IUserScore]> => {
    const url = `/api/users/`;
    return getRequest(url)
}

export const getPersonalScore = async (): Promise<IUserPersonalScore> => {
    const url = `/api/users/me`;
    return getRequest(url)
}

const getRequest = async (url: string) => {
    const options = {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
    };
    let data = await fetch(url, options)
        .then(res => { return res.json() })
        .catch(err => { console.log('Error: ', err) })
    return data
}