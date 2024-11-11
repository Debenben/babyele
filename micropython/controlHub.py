from pybricks.hubs import InventorHub
from pybricks.parameters import Color, Button
from pybricks.tools import wait, StopWatch, Matrix

from umath import floor
from ustruct import unpack_from, pack, pack_into
from urandom import randint

_HUBID = const(0)

_CMD_KEEPALIVE = const(0)
_CMD_SPEED = const(1)
_CMD_ANGLE = const(2)
_CMD_RESET = const(3)
_CMD_SHUTDOWN = const(4)

_CMD_KEEPALIVE_PACK = [pack('<B12h',_CMD_KEEPALIVE, 0,0,0, 0,0,0, 0,0,0, 0,0,0)]
_CMD_SHUTDOWN_PACK = [pack('<B12h',_CMD_SHUTDOWN, 0,0,0, 0,0,0, 0,0,0, 0,0,0)]

_BUTTON_IDLE = const(0)
_BUTTON_ACTIVE = const(1)
_BUTTON_SELECT = const(2)
_BUTTON_INACTIVE = const(3)

_SELECT_RETURN = const(7)
_SELECT_SHUTDOWN = const(8)

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
buttonMode = _BUTTON_IDLE
selection = _SELECT_RETURN
hubSensorData = [0, 0, 0, 0, 0, 0, 0]
hubTimestamps = [StopWatch(), StopWatch(), StopWatch(), StopWatch(), StopWatch(), StopWatch(), StopWatch()]


hub = InventorHub(observe_channels=[0,1,2,3,4,5,6], broadcast_channel=_HUBID)
hub.system.set_stop_button(None)
hub.ble.broadcast(_CMD_KEEPALIVE_PACK)
hub.speaker.volume(10)

def getSpeedCmd(speed, counter):
    buffer = bytearray(pack('<B12h',_CMD_SPEED, 0,0,0, 0,0,0, 0,0,0, 0,0,0))
    pack_into('<h', buffer, 1 + 2*counter, speed)
    return [buffer]


def getStatus():
    status = 0
    if(hub.battery.voltage() > 7000):
        status += 1
    status += 32
    for i in range(1, 7):
        if(hubTimestamps[i].time() > 100):
            status -= 32
            break
    if(buttonMode):
        status += 64
    return status

def executeCommand(data):
    global hubTimestamps, hubSensorData
    try:
        cmd = unpack_from('<B', data[0], 0)[0]
    except:
        #print("failed to unpack", data)
        return
    hubSensorData[0] = data
    hubTimestamps[0].reset()
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
    global hubSensorData, hubTimestamps
    for i in range(1, 7):
        receive = hub.ble.observe(i)
        if receive:
            hubSensorData[i] = receive[0]
            try:
                status = receive[0][0]
            except:
                #print("failed to unpack", receive)
                status = 0
            #print("receive", i, hubSensorData[i], status)
            if (i <= 4 and (status & 0b00110011 == 0b00100011)) or (i > 4 and (status & 0b00111111 == 0b00111111)):
                hubTimestamps[i].reset()


def getCommand():
    global buttonMode, selection, loopCounter
    #print("button mode is", buttonMode, selection)
    if buttonMode == _BUTTON_IDLE:
        if hub.buttons.pressed() == {Button.CENTER}:
            hub.ble.broadcast(getSpeedCmd(0, 0))
            hub.speaker.beep(1000, 20)
            buttonMode = _BUTTON_ACTIVE
            selection = _SELECT_RETURN
        else:
            hub.ble.broadcast(_CMD_KEEPALIVE_PACK)
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
                hub.ble.broadcast(_CMD_SHUTDOWN_PACK)
                executeCommand(_CMD_SHUTDOWN_PACK)
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
            if(selection > 0 and selection < 5):
                motor = 1
                if(roll < -15):
                    motor = 2
                elif(roll > 15):
                    motor = 0
                command = getSpeedCmd(pitch*30, motor + 3*(selection - 1))
                hub.ble.broadcast(command)
            elif(selection > 4 and selection < 7):
                motor = 0
                if(roll < -20):
                    motor = 1
                elif(roll < 0):
                    motor = 0
                elif(roll < 20):
                    motor = 3
                else:
                    motor = 4
                command = getSpeedCmd(pitch*30, motor + 6*(selection - 5))
                hub.ble.broadcast(command)



def setLedColor():
    global loopCounter
    status = getStatus()
    h = 0
    s = 100
    v = 0
    matrix = _LEDICONS[0]*0
    if(status & 0b01111111 == 0b00100001):
        h = 240
        for i in range(7):
            if(randint(0, 2**7) & 2**i == 2**i):
                matrix += _LEDICONS[i]
    elif(status & 0b01111111 == 0b00000001):
        h = 160
        matrix += _LEDICONS[0]
        for i in range(1, 7):
            if(hubTimestamps[i].time() < 200):
                matrix += _LEDICONS[i]
    elif(status & 0b01000000 == 0b01000000):
        h = 10 + floor(loopCounter/250)*30
        s = 90
        v = 100
        matrix = _LEDICONS[selection]

    if(loopCounter < 10 or loopCounter > 990):
        h = 0
        s = 0
        v = 100
    elif(loopCounter < 15 or loopCounter > 985):
        h = 0
        s = 0
        v = 0
    elif(status & 0b01000000 == 0b00000000):
        v = 20 + 2e-4*(500 - loopCounter)**2
    hub.light.on(Color(h, s, v))
    hub.display.icon(matrix)
    loopCounter = (loopCounter + 1) % 1000



while(True):
    getCommand()
    getSensorData()
    setLedColor()
