import { Rectangle, TextBlock, Container, Control, Image } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText } from './infobox';

export class LegInfobox extends Infobox {
  gauge: Container;
  speedArrow: Indicator;
  angleArrow: Indicator;
  tiltArrow: Indicator;
  rotationValue: number = 0;
  tiltValue: number = 0;
  infoText: TextBlock;

  constructor(name: string, preview: boolean, guiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }
  addControls() {
    this.gauge = buildAngleGauge(this);
    this.panel.addControl(this.gauge);
    ipcRenderer.on('notifyLegRotation', this.updateAngle);
    ipcRenderer.on('notifyTilt', this.updateTilt);
    ipcRenderer.send(this.name.replace("Top","").replace("Bottom","").replace("Mount",""), "getProperties");
  }
  removeControls() {
    ipcRenderer.removeListener('notifyLegRotation', this.updateAngle);
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
  }
  updateTilt = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.tiltValue = extractCoordinate(arg2, this.name);
      this.tiltArrow.rotation = rotationToGauge(this.tiltValue);
      if(this.tiltArrow.highlight) {
	this.infoText.text = printDegree(this.tiltValue);
      }
    }
  }
  updateAngle = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.rotationValue = extractCoordinate(arg2, this.name);
      if(!this.angleArrow.highlight) {
        this.angleArrow.rotation = rotationToGauge(this.rotationValue);
        if(this.infoText.color == "black") this.infoText.text = printDegree(this.rotationValue);
      }
    }
  }
}

const printDegree = (rad: number) => (180*rad/Math.PI).toFixed(2) + "°";

class Indicator extends Container {
  highlight = false;
  select = false;
  arrowImage = new Image("arrow", "../public/arrow_u.svg");
  constructor() {
    super();
    this.arrowImage.widthInPixels = 30;
    this.arrowImage.heightInPixels = 30;
    this.arrowImage.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.addControl(this.arrowImage);
  }
  updateImage() {
    this.arrowImage.source = "../public/arrow_" + (this.select ? "s" : (this.highlight ? "h" : "u")) + ".svg";
  }
}

const extractCoordinate = (vec3: number[], partName: string) => {
  if(partName.endsWith("Mount")) return vec3[0];
  else if(partName.endsWith("Top")) return vec3[1];
  else if(partName.endsWith("Bottom")) return vec3[2];
}
const gaugeToRotation = (angle: number) => {
  return angle > 0 ? Math.PI - angle : -Math.PI - angle;
}
const rotationToGauge = gaugeToRotation;
const gaugeToSpeed = (angle: number) => {
  let speed = Math.round(4000*angle/Math.PI);
  if(speed > 1000) speed = 1000;
  else if (speed < -1000) speed = -1000;
  return speed;
}

const buildAngleGauge = (infobox: LegInfobox) => {
  const gauge = new Container();
  gauge.widthInPixels = 240;
  gauge.heightInPixels = 280;
  gauge.paddingBottomInPixels = -0.05*infobox.widthInPixels;
  gauge.paddingTopInPixels = 0.05*infobox.widthInPixels;
  const innerRadius = 80;
  const middleRadius = 110;
  const outerRadius = 140;

  const scale = new Image("scale", "../public/dial.svg");
  gauge.addControl(scale);

  infobox.infoText = buildText("---");
  infobox.infoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  gauge.addControl(infobox.infoText);

  infobox.speedArrow = new Indicator();
  infobox.speedArrow.widthInPixels = 2*outerRadius;
  infobox.speedArrow.heightInPixels = 2*outerRadius;
  gauge.addControl(infobox.speedArrow);

  infobox.angleArrow = new Indicator();
  infobox.angleArrow.arrowImage.rotation = Math.PI;
  infobox.angleArrow.widthInPixels = 2*middleRadius;
  infobox.angleArrow.heightInPixels = 2*middleRadius;
  gauge.addControl(infobox.angleArrow);

  infobox.tiltArrow = new Indicator();
  infobox.tiltArrow.widthInPixels = 2*innerRadius;
  infobox.tiltArrow.heightInPixels = 2*innerRadius;
  gauge.addControl(infobox.tiltArrow);

  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  const gaugeOnPointer = (vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/infobox.guiTexture.getScale();
    const angle = Math.atan2(xval, yval);
    if(radius < outerRadius && radius > middleRadius && Math.abs(angle) < 0.9 && !infobox.angleArrow.select && !infobox.tiltArrow.select) {
      infobox.speedArrow.highlight = true;
      infobox.angleArrow.highlight = false;
      infobox.tiltArrow.highlight  = false;
      infobox.speedArrow.rotation = (angle > Math.PI/4 ? Math.PI/4 : (angle < -Math.PI/4 ? -Math.PI/4 : angle));
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = gaugeToSpeed(angle).toString();
      if(infobox.speedArrow.select) {
        ipcRenderer.send(infobox.name, "requestRotationSpeed", gaugeToSpeed(angle));
      }
    }
    else if (radius < middleRadius && radius > innerRadius && !infobox.speedArrow.select && !infobox.tiltArrow.select) {
      infobox.speedArrow.highlight = false;
      infobox.angleArrow.highlight = true;
      infobox.tiltArrow.highlight  = false;
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = angle;
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = printDegree(gaugeToRotation(angle));
      if(infobox.angleArrow.select){
        ipcRenderer.send(infobox.name, "requestRotationAngle", gaugeToRotation(angle));
      }
    }
    else if (radius < innerRadius && !infobox.speedArrow.select && !infobox.angleArrow.select) {
      infobox.speedArrow.highlight = false;
      infobox.angleArrow.highlight = false;
      infobox.tiltArrow.highlight  = true;
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = printDegree(infobox.tiltValue);
      if(infobox.tiltArrow.select) {
        ipcRenderer.send(infobox.name, "requestSync");
      }
    }
    else if (!infobox.speedArrow.select && !infobox.angleArrow.select && !infobox.tiltArrow.select) {
      infobox.speedArrow.highlight = false;
      infobox.angleArrow.highlight = false;
      infobox.tiltArrow.highlight  = false;
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "black";
      infobox.infoText.text = printDegree(infobox.rotationValue);
    }
    infobox.speedArrow.updateImage();
    infobox.angleArrow.updateImage();
    infobox.tiltArrow.updateImage();
  };
  mouseOverlay.onPointerMoveObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerOutObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerDownObservable.add((vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/infobox.guiTexture.getScale();
    const angle = Math.atan2(xval, yval);
    if(radius < outerRadius && radius > middleRadius && Math.abs(angle) < 0.9) {
      infobox.speedArrow.select = true;
    }
    else if (radius < middleRadius && radius > innerRadius) {
      infobox.angleArrow.select = true;
    }
    else if (radius < innerRadius) {
      infobox.tiltArrow.select = true;
    }
    gaugeOnPointer(vec);
  });
  mouseOverlay.onPointerUpObservable.add((vec) => {
    if(infobox.speedArrow.select) {
      ipcRenderer.send(infobox.name, "requestRotationSpeed", 0);
    }
    infobox.speedArrow.select = false;
    infobox.angleArrow.select = false;
    infobox.tiltArrow.select  = false;
    gaugeOnPointer(vec);
  });
  gauge.addControl(mouseOverlay);
  return gauge;
}
