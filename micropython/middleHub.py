from pybricks.hubs import TechnicHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Color, Port, Button, Axis
from pybricks.tools import StopWatch

from ustruct import unpack_from, pack, pack_into
from umath import floor


_HUBID = const(5)
_MOTORPORTS = [Port.B, Port.D, Port.A, Port.C]

_CMD_KEEPALIVE = const(0)
_CMD_SPEED = const(1)
_CMD_ANGLE = const(2)
_CMD_RESET = const(3)
_CMD_SHUTDOWN = const(4)

_CMD_SHUTDOWN_PACK = [pack('<B12h',_CMD_SHUTDOWN, 0,0,0, 0,0,0, 0,0,0, 0,0,0)]

_BUTTON_IDLE = const(0)
_BUTTON_ACTIVE = const(1)
_BUTTON_SELECT = const(2)
_BUTTON_INACTIVE = const(3)


loopCounter = 0
buttonMode = _BUTTON_IDLE
currentCommand = 0
currentChecksum = 0
commandTimestamp = StopWatch()
motors = [0, 0, 0, 0]
imuA = [0.0, 0.0, 0.0]
angles = [0, 0, 0, 0]
status = 0

hub = TechnicHub(observe_channels=[0], broadcast_channel=_HUBID)
hub.system.set_stop_button(None)


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
    if(commandTimestamp.time() < 100):
        status += 32
    if(buttonMode):
        status += 64


def executeCommand(data):
    global motors, currentCommand, currentChecksum, commandTimestamp
    checksum = 0
    try:
        command = unpack_from('<B', data[0], 0)[0]
        mount1, top1, bottom1, mount2, top2, bottom2 = unpack_from('<hhhhhh', data[0], 1 + 12*(_HUBID - 5))
        for i in range(25):
            checksum ^= unpack_from('<B', data[0], i)[0]
    except:
        #print("failed to unpack", data)
        return
    commandTimestamp.reset()
    currentCommand = data
    currentChecksum = checksum
    #print("command", cmd, mount1, top1, mount2, top2)
    if command == _CMD_KEEPALIVE:
        pass
    elif command == _CMD_SPEED:
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
    elif command == _CMD_RESET:
        target = [10*mount1, 10*top1, 10*mount2, 10*top2]
        for i in range(0, 4):
            try:
                motors[i].reset_angle(target[i])
            except:
                getMotor(_MOTORPORTS[i])
    elif command == _CMD_SHUTDOWN:
        hub.system.shutdown()


def getSensorValues():
    global motors, imuA, angles
    imuA = list(Axis.Z.T*hub.imu.orientation())
    for i in range(0, 4):
        try:
            angles[i] = motors[i].angle()
            #print("angle is", angles[i])
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
            receive = hub.ble.observe(0)
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
    data = pack('<BB7h', status, currentChecksum, *imuV, floor(0.1*angles[0]), floor(0.1*angles[1]), floor(0.1*angles[2]), floor(0.1*angles[3]))
    #print("data is", data)
    hub.ble.broadcast([data])


while(True):
    getCommand()
    getSensorValues()
    getStatus()
    setLedColor()
    transmitSensorValues()
