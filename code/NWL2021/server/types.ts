import { Socket } from "socket.io";
import { ILaureate } from "./database/laureates/laureates.types";
import { IQuestion } from "./database/questions/questions.types";

export interface Player extends Position {
  inAnswer: boolean;
  laureate: any;
  socket?: Socket;
  previousPositions: Position[];
  status: playerStatus;
}

export interface Position {
  x: number;
  y: number;
}
export interface BoxPosition extends Position {
  width: number;
  height: number;
}

export interface GameState {
  players: [
    {
      id: string;
      x: number;
      y: number;
      inAnswer: boolean;
      laureate: ILaureate;
      previousPositions: Position[];
      status: playerStatus;
    }
  ];
  question: IQuestion;
}

export type MonitoringEvent = ServerEvent | UserEvent | DatabaseEvent | GameEngineEvent;

interface IMonitoringEvent {
  origin: "mongodb" | "gameEngine" | "user" | "screen" | "server";
  action: string;
}

export interface ServerEvent extends IMonitoringEvent {
  origin: "server";
  url: string;
}

export interface DatabaseEvent extends IMonitoringEvent {
  origin: "mongodb";
  collection: string;
}

export interface GameEngineEvent extends IMonitoringEvent {
  origin: "gameEngine";
}

export interface UserEvent extends IMonitoringEvent {
  origin: "user";
  userID: string;
  position?: Position;
}

type playerStatus =
  | "left"
  | "up"
  | "down"
  | "right"
  | "hit"
  | "win"
  | "lose"
  | "idle";

export type GameStatus =
  | "demo"
  | "showQuestion"
  | "pickAnswer"
  | "showResult";