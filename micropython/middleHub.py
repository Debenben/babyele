from pybricks.hubs import TechnicHub
from pybricks.messaging import BLERadio
from pybricks.pupdevices import Motor
from pybricks.parameters import Color, Port, Button, Axis
from pybricks.tools import StopWatch

from ustruct import unpack_from, pack, pack_into
from umath import floor


_HUBID = const(5)
_MOTORPORTS = [Port.B, Port.D, Port.A, Port.C]

_CMD_SUBCMD = const(0)
_CMD_SPEED = const(1)
_CMD_ANGLE = const(2)
_CMD_DATA = const(3)

_SUBCMD_WAIT = const(0)
_SUBCMD_SHUTDOWN = const(1)
_SUBCMD_STORE = const(2)
_SUBCMD_EXECUTE = const(3)
_SUBCMD_RESET = const(4)

_CMD_SHUTDOWN_PACK = [pack('<3B11h',_CMD_SUBCMD, _SUBCMD_SHUTDOWN,0,0,0, 0,0,0, 0,0,0, 0,0,0)]

_BUTTON_IDLE = const(0)
_BUTTON_ACTIVE = const(1)
_BUTTON_SELECT = const(2)
_BUTTON_INACTIVE = const(3)


loopCounter = 0
buttonMode = _BUTTON_INACTIVE
currentCommand = 0
currentChecksum = 0
commandTimestamp = -100000
motors = [0, 0, 0, 0]
imuA = [0.0, 0.0, 0.0]
angles = [0, 0, 0, 0]
speeds = [0, 0, 0, 0]
status = 0

hub = TechnicHub()
hub.system.set_stop_button(None)
radio = BLERadio(observe_channels=[0], broadcast_channel=_HUBID)
time = StopWatch()


def getSpeedCmd(speed, counter):
    buffer = bytearray(pack('<B12h',_CMD_SPEED, 0,0,0, 0,0,0, 0,0,0, 0,0,0))
    pack_into('<h', buffer, 1 + 12*(_HUBID - 5) + 2*(counter + floor(counter/2)), speed)
    return [buffer]


def getMotor(port):
    global motors
    i = _MOTORPORTS.index(port)
    if motors[i]:
        motors[i].close()
    try:
        motors[i] = Motor(port, reset_angle=False)
        #print("motor found", port)
    except:
        motors[i] = 0


def getStatus():
    global status
    status = 0
    if(hub.battery.voltage() > 7000):
        status += 1
    for i in range(0, 4):
        if motors[i]:
            status += 2**(i+1)
    if(time.time() - commandTimestamp < 100):
        status += 32
    if(buttonMode):
        status += 64


def updateCurrentCommand(data):
    global currentCommand, currentChecksum, commandTimestamp
    checksum = 0
    try:
        for i in range(25):
            checksum ^= data[0][i]
    except:
        #print("failed to calculate checksum")
        return
    commandTimestamp = time.time()
    currentCommand = data
    currentChecksum = checksum


def executeCommand(data):
    global motors
    try:
        command = data[0][0]
        if command == _CMD_SUBCMD:
            updateCurrentCommand(data)
            subcmd = data[0][1]
            if subcmd == _SUBCMD_WAIT:
                pass
            elif subcmd == _SUBCMD_SHUTDOWN:
                hub.system.shutdown()
            elif subcmd == _SUBCMD_STORE:
                pass
            elif subcmd == _SUBCMD_EXECUTE:
                pass
        elif command == _CMD_DATA:
            if currentCommand[0][1] == _CMD_SUBCMD and currentCommand[0][2] == _SUBCMD_STORE:
                updateCurrentCommand(data)
                pass
            if currentCommand[0][1] == _CMD_SUBCMD and currentCommand[0][2] == _SUBCMD_RESET:
                updateCurrentCommand(data)
                mount1, top1, bottom1, mount2, top2, bottom2 = unpack_from('<hhhhhh', data[0], 1 + 12*(_HUBID - 5))
                target = [10*mount1, 10*top1, 10*mount2, 10*top2]
                for i in range(0, 4):
                    try:
                        motors[i].reset_angle(target[i])
                    except:
                        getMotor(_MOTORPORTS[i])
            else:
                updateCurrentCommand(data)
                #print("recieved data after cmd", currentCommand[0])
                return
        else:
            mount1, top1, bottom1, mount2, top2, bottom2 = unpack_from('<hhhhhh', data[0], 1 + 12*(_HUBID - 5))
            updateCurrentCommand(data)
            if command == _CMD_SPEED:
                target = [2*mount1, top1, 2*mount2, top2]
                for i in range(0, 4):
                    try:
                        if target[i] == 0:
                            motors[i].brake()
                        else:
                            motors[i].run(target[i])
                    except:
                        getMotor(_MOTORPORTS[i])
            elif command == _CMD_ANGLE:
                target = [10*mount1, 10*top1, 10*mount2, 10*top2]
                for i in range(0, 4):
                    try:
                        motors[i].track_target(target[i])
                    except:
                        getMotor(_MOTORPORTS[i])
            else:
                #print("unknown command", command)
                return
    except:
        #print("failed to unpack", data)
        return


def getSensorValues():
    global motors, imuA, angles, speeds
    imuA = list(Axis.Z.T*hub.imu.orientation())
    for i in range(0, 4):
        try:
            angles[i] = motors[i].angle()
            speeds[i] = motor[i].speed()
            #print("angle is", angles[i], "speed", speeds[i])
        except:
            getMotor(_MOTORPORTS[i])



def getCommand():
    global buttonMode, loopCounter
    #print("button mode is", buttonMode)
    if buttonMode == _BUTTON_IDLE:
        if hub.button.pressed():
            executeCommand(getSpeedCmd(0, 0))
            buttonMode = _BUTTON_ACTIVE
        else:
            receive = radio.observe(0)
            if receive:
                executeCommand(receive)
    elif buttonMode == _BUTTON_ACTIVE:
        if hub.button.pressed():
            loopCounter = 0
        else:
            buttonMode = _BUTTON_SELECT
    elif buttonMode == _BUTTON_INACTIVE:
        if hub.button.pressed():
            loopCounter = 0
        else:
            buttonMode = _BUTTON_IDLE
    elif buttonMode == _BUTTON_SELECT:
        if hub.button.pressed():
            speed = 0
            if loopCounter < 250:
                speed = 1000
            elif loopCounter < 500:
                speed = -1000
            elif loopCounter < 750:
                executeCommand(_CMD_SHUTDOWN_PACK)

            if speed:
                buttonTimestamp = StopWatch()
                buttonTimestamp.reset()
                counter = 0
                while buttonTimestamp.time() < 500:
                    if buttonMode == _BUTTON_INACTIVE and hub.button.pressed():
                        buttonMode = _BUTTON_SELECT
                        buttonTimestamp.reset()
                        counter += 1
                    if buttonMode == _BUTTON_SELECT and not hub.button.pressed():
                        buttonMode = _BUTTON_INACTIVE
                executeCommand(getSpeedCmd(speed, counter))

            buttonMode = _BUTTON_INACTIVE


def setLedColor():
    global loopCounter
    h = 0
    s = 100
    v = 0
    if(status & 0b01111111 == 0b00111111): # battery, motors, bluetooth
        h = 240
    elif(status & 0b01111111 == 0b00011111): # battery, motors
        h = 160
    elif(status & 0b01000000 == 0b01000000): # selected
        if loopCounter < 250:
            h = 10
            s = 90
            v = 100
        elif loopCounter < 500:
            h = 120
            s = 90
            v = 100
        elif loopCounter < 750:
            h = 250
            s = 90
            v = 100
        else:
            h = 0
            s = 0
            v = 0
    if(loopCounter < 10 or loopCounter > 990):
        h = 0
        s = 0
        v = 100
    elif(loopCounter < 15 or loopCounter > 985):
        h = 0
        s = 0
        v = 20
    elif(status & 0b01000000 == 0b00000000): # not selected
        v = 20 + 2e-4*(500 - loopCounter)**2
    hub.light.on(Color(h, s, v))
    loopCounter = (loopCounter + 1) % 1000


def transmitSensorValues():
    imuV = [0, 0, 0]
    for j in range(3):
        imuV[j] = floor(9806.65*imuA[j])
    data = pack('<BB11h', status, currentChecksum, *imuV, floor(0.1*angles[0]), floor(0.1*angles[1]), floor(0.1*angles[2]), floor(0.1*angles[3]), *speeds)
    #print("data is", data)
    radio.broadcast([data])


while(True):
    getCommand()
    getSensorValues()
    getStatus()
    setLedColor()
    transmitSensorValues()
