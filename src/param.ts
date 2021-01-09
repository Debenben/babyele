export enum Modes {
  OFFLINE    =  0,
  WAITING    =  1,
  STANDING   =  2,
  FORWARD    =  3,
  READY0     = 10,
  READY1     = 11,
  READY2     = 12,
  READY3     = 13,
  DOWN       = 20,
}

export const allowSwitch = (fromMode: Modes, toMode: Modes) => {
  switch(fromMode) {
    case Modes.OFFLINE:
      return [ Modes.OFFLINE ].includes(toMode);
    case Modes.WAITING:
      return [ Modes.OFFLINE, Modes.WAITING ].includes(toMode);
    case Modes.STANDING:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.READY0, Modes.FORWARD, Modes.DOWN ].includes(toMode);
    case Modes.READY0:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.READY0, Modes.READY1, Modes.READY2, Modes.READY3, Modes.FORWARD ].includes(toMode);
    case Modes.READY1:
    case Modes.READY2:
    case Modes.READY3:
    case Modes.FORWARD:
      return [ Modes.OFFLINE, Modes.READY0, Modes.READY1, Modes.READY2, Modes.READY3, Modes.FORWARD ].includes(toMode);
    case Modes.DOWN:
      return [ Modes.OFFLINE, Modes.STANDING, Modes.DOWN ].includes(toMode);
    default:
      return false;
  }
}


export const LEG_LENGTH_TOP = 185.0;
export const LEG_LENGTH_BOTTOM = 200.0;
export const LEG_SEPARATION_WIDTH = 225.0;
export const LEG_SEPARATION_LENGTH = 288.0;
