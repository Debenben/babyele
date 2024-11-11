from pybricks.hubs import TechnicHub
from pybricks.pupdevices import Motor, ColorDistanceSensor
from pybricks.parameters import Color, Port, Button
from pybricks.tools import StopWatch
from pybricks.iodevices import PUPDevice
from ustruct import unpack_from, pack, pack_into
from umath import floor, sqrt


_HUBID = const(1)
_MOTORPORT = Port.A
_TILTPORT = Port.B
_DISTANCEPORT = Port.C

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
currentTarget = 0
commandTimestamp = StopWatch()
motor = 0
tiltSensor = 0
distanceSensor = 0
imuA = [[0.0, 0.0, 0.0]]*10
angle = 0
tiltA = [[0, 0, 0]]*10
distance = 0
status = 0


hub = TechnicHub(observe_channels=[0], broadcast_channel=_HUBID)
hub.system.set_stop_button(None)


def getSpeedCmd(speed):
    buffer = bytearray(pack('<B12h',_CMD_SPEED, 0,0,0, 0,0,0, 0,0,0, 0,0,0))
    pack_into('<h', buffer, 5 + 6*(_HUBID - 1), speed)
    return [buffer]


def getMotor(port):
    global motor
    if motor:
        motor.close()
    try:
        motor = Motor(port, reset_angle=False)
        #print("motor found")
    except:
        motor = 0


def getTiltSensor(port):
    global tiltSensor
    try:
        tiltSensor = PUPDevice(port)
        if(tiltSensor.info()["id"] != 34):
            tiltSensor = 0
        #else:
            #print("tilt found")
    except:
        tiltSensor = 0


def getDistanceSensor(port):
    global distanceSensor
    try:
        distanceSensor = ColorDistanceSensor(port)
        #print("distance sensor found")
    except:
        distanceSensor = 0

def getStatus():
    global status
    status = 0
    if(hub.battery.voltage() > 7000):
        status += 1
    if(motor):
        status += 2
    if(tiltSensor):
        status += 4
    if(distanceSensor):
        status += 8
    if(commandTimestamp.time() < 100):
        status += 32
    if(buttonMode):
        status += 64


def executeCommand(data):
    global motor, currentCommand, currentTarget, commandTimestamp
    try:
        currentCommand = unpack_from('<B', data[0], 0)[0]
        mount, top, bottom = unpack_from('<hhh', data[0], 1 + 6*(_HUBID - 1))
    except:
        #print("failed to unpack", data)
        return

    commandTimestamp.reset()
    #print("command", cmd, bottom)
    currentTarget = bottom
    if currentCommand == _CMD_KEEPALIVE:
        pass
    elif currentCommand == _CMD_SPEED:
        try:
            if currentTarget == 0:
                motor.brake()
            else:
                motor.run(motor.control.limits()[0]*currentTarget/1000)
        except:
            getMotor(_MOTORPORT)
    elif currentCommand == _CMD_ANGLE:
        try:
            motor.track_target(currentTarget*10)
        except:
            getMotor(_MOTORPORT)
    elif currentCommand == _CMD_RESET:
        try:
            motor.reset_angle(currentTarget*10)
        except:
            getMotor(_MOTORPORT)
    elif currentCommand == _CMD_SHUTDOWN:
        hub.system.shutdown()


def getSensorValues():
    global motor, tiltSensor, distanceSensor, imuA, angle, tiltA, distance
    imuA[loopCounter % 10] = list(hub.imu.acceleration())
    try:
        angle = motor.angle()
        #print("angle is", angle)
    except:
        getMotor(_MOTORPORT)
    try:
        [x,y,z] = tiltSensor.read(3)
        if(x == 45):
            x = sqrt(2*45**2 - y**2 - z**2)
        elif(x == -45):
            x = -sqrt(2*45**2 - y**2 - z**2)
        elif(y == 45):
            y = sqrt(2*45**2 - x**2 - z**2)
        elif(y == -45):
            y = -sqrt(2*45**2 - x**2 - z**2)
        elif(z == 45):
            z = sqrt(2*45**2 - x**2 - y**2)
        elif(z == -45):
            z = -sqrt(2*45**2 - x**2 - y**2)
        tiltA[loopCounter % 10] = [x, y, z]
        #print("tilt is", [x, y, z])
    except:
        getTiltSensor(_TILTPORT)
    try:
        distance = distanceSensor.distance()
        #print("distance is", distance)
    except:
        getDistanceSensor(_DISTANCEPORT)


def getCommand():
    global buttonMode, loopCounter
    #print("button mode is", buttonMode)
    if buttonMode == _BUTTON_IDLE:
        if hub.button.pressed():
            executeCommand(getSpeedCmd(0))
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
            if loopCounter < 250:
                executeCommand(getSpeedCmd(1000))
            elif loopCounter < 500:
                executeCommand(getSpeedCmd(-1000))
            elif loopCounter < 750:
                executeCommand(_CMD_SHUTDOWN_PACK)
            buttonMode = _BUTTON_INACTIVE


def setLedColor():
    global loopCounter
    h = 0
    s = 100
    v = 0
    if(status & 0b01110111 == 0b00100111): # battery, motor, accelerometer, ignored, empty port, bluetooth commander, not selected
        h = 240
    elif(status & 0b01110111 == 0b00000111): # battery, motor, accelerometer, ignored, empty port, no bluetooth commander, not selected
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
    tiltV = [0, 0, 0]
    for j in range(3):
        for i in range(10):
            imuV[j] += imuA[i][j]
            tiltV[j] += tiltA[i][j]
        imuV[j] = floor(0.1*imuV[j])
        tiltV[j] = floor(15.4*tiltV[j])
    data = pack('<BB8h', status, currentCommand, *imuV, floor(0.1*angle), *tiltV, distance)
    #print("data is", data)
    hub.ble.broadcast([data])


while(True):
    getCommand()
    getSensorValues()
    getStatus()
    setLedColor()
    transmitSensorValues()

