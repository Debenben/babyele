import { Grid, TextBlock, Image, Rectangle } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, Gauge, buildText, ThreePrint, buildGauge, ToggleButton } from './infobox';
import { GuiTexture } from './guitexture';

export class HubInfobox extends Infobox {
  accelerationDogText: ThreePrint;
  accelerationTopText: ThreePrint;
  accelerationBottomText: ThreePrint;
  positionText: ThreePrint;
  bendForward: ToggleButton;
  showAcceleration: boolean;
  gauge: Gauge;
  stateGrid: Grid;
  stateIcons: StateIcon[] = [];
  timestampsLine: DensityLine;
  timestampsText: TextBlock;
  rssisLine: DensityLine;
  rssisText: TextBlock;
  timestampsIntervalID: NodeJS.Timeout = null

  constructor(name: string, preview: boolean, guiTexture: GuiTexture) {
    super(name, preview, guiTexture);
    this.showAcceleration = guiTexture.renderer.scene.getMeshByName("dogAcceleration").isEnabled(false);
    this.addControls(preview);
  }

  addControls(preview: boolean) {
    this.stateIcons.push(new StateIcon("battery"));
    this.stateIcons.push(new StateIcon("motorA"));
    this.stateGrid = new Grid("stateGrid");
    this.stateGrid.heightInPixels = 32;
    this.stateGrid.setPaddingInPixels(0, 2, 2, 2);
    this.panel.addControl(this.stateGrid);
    const connectionGrid = new Grid("connectionGrid");
    connectionGrid.heightInPixels = 44;
    connectionGrid.addColumnDefinition(0.7);
    connectionGrid.addColumnDefinition(0.3);
    connectionGrid.addRowDefinition(20, true);
    connectionGrid.addRowDefinition(2, true);
    connectionGrid.addRowDefinition(20, true);
    connectionGrid.setPaddingInPixels(0, 2, 0, 2);
    const filler = new Rectangle("filler");
    filler.background = "#00000030";
    filler.thickness = 0;
    this.timestampsLine = new DensityLine(preview);
    connectionGrid.addControl(this.timestampsLine, 0, 0);
    connectionGrid.addControl(filler, 0, 1);
    this.timestampsText = buildText("---");
    this.timestampsText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT;
    connectionGrid.addControl(this.timestampsText, 0, 1);
    this.rssisLine = new DensityLine(preview);
    connectionGrid.addControl(filler.clone(), 2, 1);
    this.rssisText = buildText("---");
    this.rssisText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT;
    connectionGrid.addControl(this.rssisLine, 2, 0);
    connectionGrid.addControl(this.rssisText, 2, 1);
    this.panel.addControl(connectionGrid);
    this.accelerationDogText = new ThreePrint("dog a");
    this.accelerationDogText.isVisible = this.showAcceleration;
    this.panel.addControl(this.accelerationDogText);
    if(!this.name.endsWith("Center")) {
      this.stateIcons.push(new StateIcon("tiltB"));
      this.stateIcons.push(new StateIcon("sensorC"));
      this.stateIcons.push(new StateIcon("deviceD"));
      this.accelerationTopText = new ThreePrint("top a");
      this.accelerationTopText.isVisible = this.showAcceleration;
      this.accelerationBottomText = new ThreePrint("bot a");
      this.panel.addControl(this.accelerationTopText);
      this.panel.addControl(this.accelerationBottomText);
      this.accelerationBottomText.isVisible = this.showAcceleration;
      const sliderDest = this.name.replace("hub","leg");
      ipcRenderer.on('notifyBendForward', this.updateBendForward);
      this.positionText = new ThreePrint("pos");
      this.panel.addControl(this.positionText);
      ipcRenderer.on('notifyLegPosition', this.updatePosition);
      this.gauge = buildGauge(this, false);
      this.panel.addControl(this.gauge);
      this.bendForward = new ToggleButton("bend forward", "bend backward", (forward) => {
        ipcRenderer.send(sliderDest, "setBendForward", forward);
      });
      this.panel.addControl(this.bendForward);
      ipcRenderer.send(sliderDest, "getProperties");
    }
    else {
      this.stateIcons.push(new StateIcon("motorB"));
      this.stateIcons.push(new StateIcon("motorC"));
      this.stateIcons.push(new StateIcon("motorD"));
    }
    this.stateIcons.push(new StateIcon("bluetooth"));
    this.stateIcons.push(new StateIcon("wrench"));
    this.stateIcons.push(new StateIcon("unknown"));
    this.stateIcons.forEach((icon, i) => {
      this.stateGrid.addColumnDefinition(1);
      this.stateGrid.addControl(icon, 0, i);
    });
    ipcRenderer.on('notifyAcceleration', this.updateAcceleration);
    ipcRenderer.on('notifyStatus', this.updateHubStatus);
    ipcRenderer.on('notifyTimestamps', this.updateTimestamps);
    ipcRenderer.on('notifyRssis', this.updateRssis);
    ipcRenderer.send(this.name, "getProperties");
    this.timestampsIntervalID = setInterval(() => ipcRenderer.send(this.name, "getProperties"), 1000);
  }
  removeControls() {
    ipcRenderer.removeListener('notifyAcceleration', this.updateAcceleration);
    ipcRenderer.removeListener('notifyLegPosition', this.updatePosition);
    ipcRenderer.removeListener('notifyBendForward', this.updateBendForward);
    ipcRenderer.removeListener('notifyStatus', this.updateHubStatus);
    ipcRenderer.removeListener('notifyTimestamps', this.updateTimestamps);
    ipcRenderer.removeListener('notifyRssis', this.updateRssis);
    clearInterval(this.timestampsIntervalID);
    this.timestampsIntervalID = null;
  }
  setPreview = (preview: boolean) => {
      super.setPreview(preview);
      this.timestampsLine.setPreview(preview);
      this.rssisLine.setPreview(preview);
  }
  updateBendForward = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub", "leg")) {
      this.bendForward.setEnabled(arg2);
    }
  }
  updatePosition = (event, arg1, arg2) => {
    if(arg1 === this.name.replace("hub", "leg")) {
      this.positionText.setThreeText(arg2.map(e => e.toFixed(2)));
      this.gauge.setIndicatorPosition(arg2.map(e => 0.002*e));
    }
  }
  updateAcceleration = (event, arg1, arg2) => {
    if(arg1 === "dog") {
      this.accelerationDogText.setThreeText(arg2.map(e => e.toFixed(0)));
    }
    else if(arg1 === this.name.replace("hub", "leg") + "Top") {
      this.accelerationTopText.setThreeText(arg2.map(e => e.toFixed(0)));
    }
    else if(arg1 === this.name.replace("hub", "leg") + "Bottom") {
      this.accelerationBottomText.setThreeText(arg2.map(e => e.toFixed(0)));
    }
  }
  updateHubStatus = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      this.stateIcons.forEach((icon, i) => icon.setEnabled((arg2 & 2**i) == 2**i));
    }
  }
  updateTimestamps = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      const timestamps = arg2.filter(ts => ts > 0);
      const timediffs = timestamps.slice(1).map((e, i) => timestamps[i + 1] - timestamps[i]);
      const max = Math.max(...timediffs);
      this.timestampsText.text = max < 10000 ? max + " ms" : Math.round(max/1000) + " s";
      const spacing = this.timestampsLine.bins.length/max;
      this.timestampsLine.bins.fill(0);
      timediffs.forEach(e => this.timestampsLine.bins[Math.round(e*spacing)] += 1);
      this.timestampsLine.markAsDirty();
    }
  }
  updateRssis = (event, arg1, arg2) => {
    if(arg1 === this.name) {
      const rssis = arg2;
      const min = Math.min(...rssis);
      this.rssisText.text = min + " dBm";
      const spacing = this.rssisLine.bins.length/Math.abs(min);
      this.rssisLine.bins.fill(0);
      rssis.forEach(e => this.rssisLine.bins[this.rssisLine.bins.length + Math.round(e*spacing)] += 1);
      this.rssisLine.markAsDirty();
    }
  }
}

class StateIcon extends Image {
  constructor(iconName: string) {
    super(iconName, "../public/icon_" + iconName + "_u.svg");
  }
  setEnabled(enabled: boolean) {
    this.source = "../public/icon_" + this.name + (enabled ? "_s" : "_u") + ".svg";
  }
}

class DensityLine extends Rectangle {
  bins = new Array(180).fill(0)
  getColor = (e) => "rgba(0,0,0,1)"

  constructor(preview: boolean) {
    super();
    this.heightInPixels = 25;
    this.setPreview(preview);
  }
  setPreview(preview: boolean) {
    if(preview) this.getColor = (e) => "rgba(" + Math.sqrt(1000*e) + ", 255, " + Math.sqrt(1000*e) + ", " + 0.2*e + ")";
    else this.getColor = (e) => "rgba(255, " + Math.sqrt(1000*e) + ", " + Math.sqrt(1000*e) + ", " + 0.2*e + ")";
  }
  protected _localDraw(ctx: BABYLON.ICanvasRenderingContext) {
    ctx.fillStyle = "#000000c0";
    ctx.fillRect(this._currentMeasure.left, this._currentMeasure.top, this._currentMeasure.width, this._currentMeasure.height);
    const rectWidth = (this._currentMeasure.width - 10)/this.bins.length;
    this.bins.forEach((e, i) => {
      ctx.fillStyle = this.getColor(e);
      ctx.fillRect(this._currentMeasure.left + 5 + i*rectWidth, this._currentMeasure.top + 5, rectWidth, this._currentMeasure.height - 10);
    });
  }
}
