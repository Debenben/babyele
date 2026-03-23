from pybricks.hubs import InventorHub
from pybricks.parameters import Color, Button
from pybricks.tools import wait, StopWatch, Matrix

from umath import floor, acos, pi, sqrt, cos
from ustruct import unpack_from, pack, pack_into
from urandom import randint

_HUBID = const(0)

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

_SELECT_RETURN = const(7)
_SELECT_SHUTDOWN = const(8)

_LEG_LENGTH_TOP = const(193.5)
_LEG_LENGTH_BOTTOM = const(244.0)
_LEG_SEPARATION_WIDTH = const(288.0)
_LEG_SEPARATION_LENGTH = const(392.0)
_LEG_MOUNT_HEIGHT = const(36.0)
_LEG_MOUNT_WIDTH = const(76.0)
_LEG_PISTON_HEIGHT = const(96.0)
_LEG_PISTON_WIDTH = const(144.0)
_LEG_PISTON_LENGTH = const(200.0)
_LEG_FOOT_DIAMETER = const(56.0)

_LEG_TOP_HUB_ANGLE = const(0.1243549945)

_MOUNT_MOTOR_RANGE = const(400)
_MOUNT_MOTOR_MAX_SPEED = const(882)
_TOP_MOTOR_RANGE = const(-35000)
_TOP_MOTOR_MAX_SPEED = const(756)
_BOTTOM_MOTOR_RANGE = const(29531)
_BOTTOM_MOTOR_MAX_SPEED = const(756)

_LEDICONS = [
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,  50, 100,  50,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [100,  50,   0,   0,   0],
        [ 80,  50,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,  50, 100],
        [  0,   0,   0,  50,  80],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [ 80,  50,   0,   0,   0],
        [100,  50,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,  50,  80],
        [  0,   0,   0,  50, 100],
    ]
),
Matrix(
    [
        [  0,  30,   0,  30,   0],
        [  0,  50, 100,  50,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
    ]
),
Matrix(
    [
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,   0,   0,   0,   0],
        [  0,  50, 100,  50,   0],
        [  0,  30,   0,  30,   0],
    ]
),
Matrix(
    [
        [  0,  60,  80,  60,   0],
        [ 60, 100,   0, 100,  60],
        [ 80,   0, 100,   0,  80],
        [ 60, 100,   0, 100,  60],
        [  0,  60,  80,  60,   0],
    ]
),
Matrix(
    [
        [  0,  60,  80,  60,   0],
        [ 60,  20,   0,  20,  60],
        [ 80,   0,   0,   0,  80],
        [ 60,  20, 100,  20,  60],
        [  0,  60, 100,  60,   0],
    ]
)]

loopCounter = 0
commandCounter = 0
buttonMode = _BUTTON_IDLE
selection = _SELECT_RETURN
selectedSpeed = 0
hubSensorData = [None, None, None, None, None, None, None]
hubTimestamps = [-100000, -100000, -100000, -100000, -100000, -100000, -100000]
hubChecksums = [0, 0, 0, 0, 0, 0, 0]


hub = InventorHub(observe_channels=[0,1,2,3,4,5,6], broadcast_channel=_HUBID)
hub.system.set_stop_button(None)
hub.speaker.volume(10)
time = StopWatch()


def cosLaw(rSide, lSide, angle):
    return sqrt(abs(rSide**2 + lSide**2 - 2*rSide*lSide*cos(angle)))


def invCosLaw(rSide, lSide, oSide):
    cosVal = (rSide**2 + lSide**2 - oSide**2)/(2*rSide*lSide)
    if cosVal > 1.0:
        return 1.0
    elif cosVal < -1.0:
        return -1.0
    else:
        return cosVal


mountAngleOffset = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, _LEG_PISTON_LENGTH)


def getMotorAngles():
    motorAngles = [None for i in range(12)]
    for i in range(1, 5):
        if hubSensorData[i]:
            motorAngles[3*(i - 1) + 2] = unpack_from('<h', hubSensorData[i], 5)
    for i in range(5, 7):
        if hubSensorData[i]:
            motorAngles[6*(i - 5)] = unpack_from('<h', hubSensorData[i], 5)
            motorAngles[6*(i - 5) + 1] = unpack_from('<h', hubSensorData[i], 6)
            motorAngles[6*(i - 5) + 3] = unpack_from('<h', hubSensorData[i], 7)
            motorAngles[6*(i - 5) + 4] = unpack_from('<h', hubSensorData[i], 8)
    return motorAngles


def legAnglesFromMotorAngles(motorAngles):
    for i in range(5):
        pistonLength = _LEG_PISTON_LENGTH + motorAngles[3*i]/_MOUNT_MOTOR_RANGE
        motorAngles[3*i] = invCosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, pistonLength) - mountAngleOffset;
        motorAngles[3*i + 1] *= pi/_TOP_MOTOR_RANGE
        motorAngles[3*i + 2] *= pi/_BOTTOM_MOTOR_RANGE
    return motorAngles


def motorAnglesFromLegAngles(legAngles):
    for i in range(5):
        pistonLength = cosLaw(_LEG_PISTON_HEIGHT, _LEG_PISTON_WIDTH, legAngles[3*i] + mountAngleOffset);
        legAngles[3*i] = (pistonLength - LEG_PISTON_LENGTH)*MOUNT_MOTOR_RANGE;
        legAngles[3*i + 1] *= _TOP_MOTOR_RANGE/pi
        legAngles[3*i + 2] *= _BOTTOM_MOTOR_RANGE/pi
    return legAngles



def getBoundSpeed(speed):
    if speed > 1000:
        return 1000
    elif speed < -1000:
        return -1000
    return round(speed)

def getSpeedCmd(speed, counter):
    buffer = bytearray(pack('<B12h',_CMD_SPEED, 0,0,0, 0,0,0, 0,0,0, 0,0,0))
    pack_into('<h', buffer, 1 + 2*counter, speed)
    return [buffer]


def getStatus():
    status = 0
    if(hub.battery.voltage() > 7000):
        status += 1
    status += 32
    ts = time.time()
    for i in range(1, 7):
        if(ts - hubTimestamps[i] > 10000):
            status -= 32
            break
    if(buttonMode):
        status += 64
    return status

def executeCommand(data):
    global hubTimestamps, hubSensorData, hubChecksums
    checksum = 0
    try:
        cmd = data[0][0]
        for i in range(25):
            checksum ^= data[0][i]
    except:
        #print("failed to unpack", data)
        return
    hubTimestamps[0] = time.time()
    hubSensorData[0] = data
    hubChecksums[0] = checksum
    if cmd == _CMD_SHUTDOWN:
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.speaker.beep(1000, 20)
        wait(100)
        hub.system.shutdown()

def getSensorData():
    global hubSensorData, hubTimestamps, hubChecksums, commandCounter
    for i in range(1, 7):
        receive = hub.ble.observe(i)
        if receive:
            hubSensorData[i] = receive[0]
            try:
                status = receive[0][0]
                hubChecksums[i] = receive[0][1]
            except:
                #print("failed to unpack", receive)
                status = 0
            #print("receive", i, hubSensorData[i], status)
            if hubChecksums[i] == hubChecksums[0]:
                if (i <= 4 and (status & 0b00110011 == 0b00100011)) or (i > 4 and (status & 0b00111111 == 0b00111111)):
                    hubTimestamps[i] = time.time()
                    if all(hubChecksums[i] == hubChecksums[0] for i in range(6)):
                        commandCounter += 1
                        if commandCounter >= 2**16:
                            commandCounter = 0
                        command = [pack('<B12h',_CMD_KEEPALIVE, commandCounter,0,0, 0,0,0, 0,0,0, 0,0,0)]
                        #print("all checksums", hubChecksums[i])
                        sendCommand(command)



def getCommand():
    global buttonMode, selection, loopCounter, selectedSpeed
    #print("button mode is", buttonMode, selection)
    if buttonMode == _BUTTON_IDLE:
        if hub.buttons.pressed() == {Button.CENTER}:
            sendCommand(getSpeedCmd(0, 0))
            hub.speaker.beep(1000, 20)
            buttonMode = _BUTTON_ACTIVE
            selection = _SELECT_RETURN
        else:
            receive = hub.ble.observe(0)
            if receive:
                executeCommand(receive)
    elif buttonMode == _BUTTON_ACTIVE:
        if hub.buttons.pressed():
            loopCounter = 0
        else:
            buttonMode = _BUTTON_SELECT
    elif buttonMode == _BUTTON_INACTIVE:
        if hub.buttons.pressed() == {Button.CENTER}:
            loopCounter = 0
        else:
            buttonMode = _BUTTON_IDLE
    elif buttonMode == _BUTTON_SELECT:
        if hub.buttons.pressed() == {Button.CENTER}:
            if selection == _SELECT_SHUTDOWN:
                sendCommand(_CMD_SHUTDOWN_PACK)
            buttonMode = _BUTTON_INACTIVE
        elif hub.buttons.pressed() == {Button.LEFT}:
            if(selection > 0):
                selection -= 1
            else:
                selection = 8
            buttonMode = _BUTTON_ACTIVE
        elif hub.buttons.pressed() == {Button.RIGHT}:
            if(selection < 8):
                selection += 1
            else:
                selection = 0
            buttonMode = _BUTTON_ACTIVE
        else:
            pitch, roll = hub.imu.tilt()
            if(selection == 0):
                if(abs(roll*roll + pitch*pitch) > 100):
                    selectedSpeed = getBoundSpeed(roll*pitch) #TODO
                else:
                    selectedSpeed = 0
                    sendCommand(getSpeedCmd(0, 0))
            elif(selection < 5):
                motor = 0
                if(roll < -10):
                    motor = 1 + selection % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                elif(roll > 10):
                    motor = 1 + (selection + 1) % 2
                    selectedSpeed = getBoundSpeed(pitch*30)
                else:
                    selectedSpeed = 0
                sendCommand(getSpeedCmd(selectedSpeed, motor + 3*(selection - 1)))
            elif(selection < 7):
                motor = 0
                if(roll < -10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                elif(roll > 10):
                    selectedSpeed = getBoundSpeed(pitch*30)
                    motor = 3
                else:
                    selectedSpeed = 0
                sendCommand(getSpeedCmd(selectedSpeed, motor + 6*(selection - 5)))


def setLedColor():
    global loopCounter
    status = getStatus()
    h = 0
    s = 100
    v = 0
    matrix = _LEDICONS[0]*0
    if(loopCounter < 10 or loopCounter > 990):
        v = 100
        s = 0
    elif(loopCounter < 15 or loopCounter > 985):
        v = 20
        s = 0
    else:
        v = 20 + 2e-4*(500 - loopCounter)**2
    if(status & 0b01111111 == 0b00100001):
        h = 240
        for i in range(7):
            if(randint(0, 1)):
                matrix += _LEDICONS[i]
    elif(status & 0b01111111 == 0b00000001):
        h = 160
        if randint(0, 1):
            matrix += _LEDICONS[0]
        ts = time.time()
        for i in range(1, 7):
            if randint(0, 1) and (ts - hubTimestamps[i] < 10000):
                matrix += _LEDICONS[i]
    elif(status & 0b01000000 == 0b01000000): #selected
        if(selectedSpeed == 0):
            h = 60
        else:
            h = 300
            v = 0.1*abs(selectedSpeed)
        matrix = _LEDICONS[selection]
    hub.light.on(Color(h, s, v))
    hub.display.icon(matrix)
    loopCounter = (loopCounter + 1) % 1000



def sendCommand(command):
    hub.ble.broadcast(command)
    executeCommand(command)


command = [pack('<B12h',_CMD_KEEPALIVE, commandCounter,0,0, 0,0,0, 0,0,0, 0,0,0)]
sendCommand(command)
while(True):
    getCommand()
    getSensorData()
    setLedColor()
