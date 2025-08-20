from pybricks.hubs import TechnicHub
from pybricks.pupdevices import Motor, ColorDistanceSensor
from pybricks.parameters import Color, Port, Button, Axis
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
currentChecksum = 0
commandTimestamp = StopWatch()
motor = 0
tiltSensor = 0
distanceSensor = 0
angle = 0
imuA = [0, 0, 0]
tiltA = [0, 0, 0]
distance = 0
status = 0

hub = TechnicHub(observe_channels=[0], broadcast_channel=_HUBID)
hub.system.set_stop_button(None)


class TiltSensor(PUPDevice):
    def __init__(self, port):
        self.io = PUPDevice(port)
    
    __x_post = [0, 0]
    __y_post = [0, 0]
    __z_post = [0, 0]

    def acceleration(self):
        # prediction:
        x_pred = [self.__x_post[0] + self.__x_post[1], self.__x_post[1]]
        y_pred = [self.__y_post[0] + self.__y_post[1], self.__y_post[1]]
        z_pred = [self.__z_post[0] + self.__z_post[1], self.__z_post[1]]
        # measurement:
        [x,y,z] = self.read(3)
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
        # correction:
        applyKv = lambda v, y: [v[0] + 0.133*y, v[1] + 0.00931*y]
        self.__x_post = applyKv(x_pred, x - x_pred[0])
        self.__y_post = applyKv(y_pred, y - y_pred[0])
        self.__z_post = applyKv(z_pred, z - z_pred[0])
        return [self.__x_post[0], self.__y_post[0], self.__z_post[0]]


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
        tiltSensor = TiltSensor(port)
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
    global motor, currentCommand, currentChecksum, commandTimestamp
    checksum = 0
    try:
        command = unpack_from('<B', data[0], 0)[0]
        mount, top, bottom = unpack_from('<hhh', data[0], 1 + 6*(_HUBID - 1))
        for i in range(25):
            checksum ^= unpack_from('<B', data[0], i)[0]
    except:
        #print("failed to unpack", data)
        return
    commandTimestamp.reset()
    currentCommand = data
    currentChecksum = checksum
    #print("command", cmd, bottom)
    if command == _CMD_KEEPALIVE:
        pass
    elif command == _CMD_SPEED:
        try:
            if bottom == 0:
                motor.brake()
            else:
                motor.run(bottom)
        except:
            getMotor(_MOTORPORT)
    elif command == _CMD_ANGLE:
        try:
            motor.track_target(bottom*10)
        except:
            getMotor(_MOTORPORT)
    elif command == _CMD_RESET:
        try:
            motor.reset_angle(bottom*10)
        except:
            getMotor(_MOTORPORT)
    elif command == _CMD_SHUTDOWN:
        hub.system.shutdown()


def getSensorValues():
    global motor, tiltSensor, distanceSensor, angle, imuA, tiltA, distance
    imuA = list(Axis.Z.T*hub.imu.orientation())

    try:
        angle = motor.angle()
        #print("angle is", angle)
    except:
        getMotor(_MOTORPORT)
    try:
        tiltA = tiltSensor.acceleration()
        #print("tilt is", tiltA)
    except:
        getTiltSensor(_TILTPORT)
    try:
        if (status & 0b01000000 == 0b01000000): #selected
            if loopCounter == 0:
                distanceSensor.light.on(Color.RED)
            elif loopCounter == 250:
                distanceSensor.light.on(Color.GREEN)
            elif loopCounter == 500:
                distanceSensor.light.on(Color.BLUE)
            elif loopCounter == 750:
                distanceSensor.light.off()
        else:
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
    tiltV = [0, 0, 0]
    for j in range(3):
        tiltV[j] = floor(154.0966*tiltA[j])
        imuV[j] = floor(9806.65*imuA[j])
    data = pack('<BB8h', status, currentChecksum, *imuV, floor(0.1*angle), *tiltV, distance)
    #print("data is", data)
    hub.ble.broadcast([data])


while(True):
    getCommand()
    getSensorValues()
    getStatus()
    setLedColor()
    transmitSensorValues()
