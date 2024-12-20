from pybricks.hubs import TechnicHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Color, Port, Button
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
currentTarget = [0, 0, 0, 0]
commandTimestamp = StopWatch()
motors = [0, 0, 0, 0]
imuA = [[0.0, 0.0, 0.0]]*10
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
    global motors, currentCommand, currentTarget, commandTimestamp
    try:
        currentCommand = unpack_from('<B', data[0], 0)[0]
        mount1, top1, bottom1, mount2, top2, bottom2 = unpack_from('<hhhhhh', data[0], 1 + 12*(_HUBID - 5))
    except:
        #print("failed to unpack", data)
        return

    commandTimestamp.reset()
    #print("command", cmd, mount1, top1, mount2, top2)
    currentTarget = [mount1, top1, mount2, top2]
    if currentCommand == _CMD_KEEPALIVE:
        pass
    elif currentCommand == _CMD_SPEED:
        for i in range(0, 4):
            try:
                if currentTarget[i] == 0:
                    motors[i].brake()
                else:
                    motors[i].run(motors[i].control.limits()[0]*currentTarget[i]/1000)
            except:
                getMotor(_MOTORPORTS[i])
    elif currentCommand == _CMD_ANGLE:
        for i in range(0, 4):
            try:
                motors[i].track_target(currentTarget[i]*10)
            except:
                getMotor(_MOTORPORTS[i])
    elif currentCommand == _CMD_RESET:
        for i in range(0, 4):
            try:
                motors[i].reset_angle(currentTarget[i]*10)
            except:
                getMotor(_MOTORPORTS[i])
    elif currentCommand == _CMD_SHUTDOWN:
        hub.system.shutdown()
    


def getSensorValues():
    global motors, imuA, angles
    imuA[loopCounter % 10] = list(hub.imu.acceleration())
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
        h = 10 + floor(loopCounter/250)*30
        s = 90
        v = 100
    if(loopCounter < 10 or loopCounter > 990):
        h = 0
        s = 0
        v = 100
    elif(loopCounter < 15 or loopCounter > 985):
        h = 0
        s = 0
        v = 0
    elif(status & 0b01000000 == 0b00000000): # not selected
        v = 20 + 2e-4*(500 - loopCounter)**2
    hub.light.on(Color(h, s, v))
    loopCounter = (loopCounter + 1) % 1000


def transmitSensorValues():
    imuV = [0, 0, 0]
    for j in range(3):
        for i in range(10):
            imuV[j] += imuA[i][j]
        imuV[j] = floor(0.1*imuV[j])
    data = pack('<BB7h', status, currentCommand, *imuV, floor(0.1*angles[0]), floor(0.1*angles[1]), floor(0.1*angles[2]), floor(0.1*angles[3]))
    #print("data is", data)
    hub.ble.broadcast([data])


while(True):
    getCommand()
    getSensorValues()
    getStatus()
    setLedColor()
    transmitSensorValues()

