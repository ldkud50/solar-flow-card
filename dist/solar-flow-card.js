/**
 * power-flow-custom
 * Animated solar power flow card for Home Assistant
 * https://gist.github.com/ldkud50/9b60315a98c945d6e10a8f457223e3c7
 */
class PowerFlowCustomCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = {
      solar_entity:       config.solar_entity       || 'sensor.envoy_482526005369_current_power_production',
      home_entity:        config.home_entity        || 'sensor.envoy_482526005369_current_power_consumption',
      grid_import_entity: config.grid_import_entity || 'sensor.grid_import_power',
      grid_export_entity: config.grid_export_entity || 'sensor.grid_export_power',
      ev_entity:          config.ev_entity          || null,
      ev_today_entity:    config.ev_today_entity    || 'sensor.12027_emporia_energy_today',
      background_image:   config.background_image   || '/local/house.jpg',
      max_solar_kw:       config.max_solar_kw       || 10,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _fmt(val, unit) {
    if (isNaN(val) || val === null) return '0 W';
    if (unit === 'kW') return val >= 1 ? val.toFixed(1) + ' kW' : Math.round(val * 1000) + ' W';
    return val >= 1000 ? (val / 1000).toFixed(1) + ' kW' : Math.round(val) + ' W';
  }

  _getState(entityId) {
    if (!entityId || !this._hass) return { val: 0, unit: 'W' };
    const s = this._hass.states[entityId];
    if (!s) return { val: 0, unit: 'W' };
    return { val: Math.max(0, parseFloat(s.state) || 0), unit: s.attributes.unit_of_measurement || 'W' };
  }

  _render() {
    if (!this._hass || !this._config) return;
    const cfg = this._config;

    const solar = this._getState(cfg.solar_entity);
    const home  = this._getState(cfg.home_entity);
    const imp   = this._getState(cfg.grid_import_entity);
    const exp   = this._getState(cfg.grid_export_entity);
    const ev    = cfg.ev_entity ? this._getState(cfg.ev_entity) : { val: 0, unit: 'W' };
    const evDay = this._getState(cfg.ev_today_entity);

    const sw = solar.val, hw = home.val, iw = imp.val, ew = exp.val, evv = ev.val;
    const evKw = ev.unit === 'kW' ? evv : evv / 1000;
    const isCharging = evKw > 0.01;

    const son   = sw > 0.01;
    const isImp = iw > 0.01;
    const isExp = ew > 0.01;
    const evon  = cfg.ev_entity && (isCharging || evDay.val > 0.1);

    const solarToEV = isCharging && son && isExp;
    const houseToEV = isCharging && isImp;

    const evLabel    = isCharging ? this._fmt(evv, ev.unit) : evDay.val.toFixed(1) + ' kWh';
    const evSubLabel = isCharging ? '' : (evDay.val > 0.1 ? 'today' : '');

    const CS = '#ff9800', CI = '#00bfff', CE = '#00e676', CH = '#a78bfa', CV = '#ffd600';
    const gc = isExp ? CE : CI;

    const solarX = 250, solarY = 100;
    const gridX  = 85,  gridY  = 215;
    const houseX = 415, houseY = 215;
    const evX    = 418, evY    = 92;

    const pSH = 'M'+(solarX+20)+','+(solarY+45)+' C'+(solarX+75)+','+(solarY+110)+' '+(houseX-55)+','+(houseY-85)+' '+houseX+','+(houseY-44);
    const pSG = 'M'+(solarX-20)+','+(solarY+45)+' C'+(solarX-75)+','+(solarY+110)+' '+(gridX+55)+','+(houseY-85)+' '+gridX+','+(gridY-44);
    const pGH = 'M'+(gridX+44)+','+gridY+' L'+(houseX-44)+','+houseY;
    const pSE = 'M'+(solarX+44)+','+solarY+' C'+(solarX+110)+','+(solarY-30)+' '+(evX-85)+','+(evY-20)+' '+(evX-40)+','+evY;
    const pHE = 'M'+(houseX+10)+','+(houseY-44)+' C'+(houseX+65)+','+(houseY-130)+' '+evX+','+(evY+85)+' '+evX+','+(evY+40);

    const outLabel = 'Out: ' + this._fmt(ew, exp.unit);
    const inLabel  = 'In: '  + this._fmt(iw, imp.unit);
    const ss = 'fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"';
    const bg = 'background-image:url(\'' + cfg.background_image + '\');background-size:cover;background-position:center 42%;';

    this.shadowRoot.innerHTML = '<style>' +
      ':host{display:block;width:100%;border-radius:12px;overflow:hidden;}' +
      '.card{position:relative;width:100%;height:310px;' + bg + 'border-radius:12px;overflow:hidden;box-sizing:border-box;}' +
      '.overlay{position:absolute;inset:0;background:rgba(0,0,0,0.72);border-radius:12px;}' +
      'svg{position:absolute;inset:0;width:100%;height:100%;}' +
      '.nv{font-weight:700;font-family:var(--primary-font-family,sans-serif);}' +
      '.nl{font-weight:600;fill:rgba(255,255,255,0.85);font-family:var(--primary-font-family,sans-serif);}' +
      '.ns{font-weight:500;fill:rgba(255,255,255,0.6);font-family:var(--primary-font-family,sans-serif);}' +
      '.fl{fill:none;stroke-dasharray:10 6;animation-timing-function:linear;animation-iteration-count:infinite;animation-duration:2.5s;}' +
      '@keyframes dash-fwd{0%{stroke-dashoffset:300}100%{stroke-dashoffset:0}}' +
      '@keyframes dash-rev{0%{stroke-dashoffset:0}100%{stroke-dashoffset:300}}' +
      '</style>' +
      '<div class="card"><div class="overlay"></div>' +
      '<svg viewBox="0 0 500 310" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + pGH + '" ' + ss + ' stroke-width="2.5"/>' +
      (evon ? '<path d="' + pSE + '" ' + ss + '/>' : '') +
      (evon ? '<path d="' + pHE + '" ' + ss + '/>' : '') +
      (isImp ? '<path d="' + pGH + '" fill="none" stroke="' + CI + '" stroke-width="2.5" opacity="0.2"/><path class="fl" d="' + pGH + '" stroke="' + CI + '" stroke-width="2.5" stroke-dashoffset="300" style="animation-name:dash-fwd"/>' : '') +
      (isExp && !son ? '<path d="' + pGH + '" fill="none" stroke="' + CE + '" stroke-width="2.5" opacity="0.2"/><path class="fl" d="' + pGH + '" stroke="' + CE + '" stroke-width="2.5" style="animation-name:dash-rev"/>' : '') +
      (son ? '<path d="' + pSH + '" fill="none" stroke="' + CS + '" stroke-width="2" opacity="0.2"/><path class="fl" d="' + pSH + '" stroke="' + CS + '" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>' : '') +
      (son && isExp ? '<path d="' + pSG + '" fill="none" stroke="' + CE + '" stroke-width="2" opacity="0.2"/><path class="fl" d="' + pSG + '" stroke="' + CE + '" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>' : '') +
      (solarToEV ? '<path d="' + pSE + '" fill="none" stroke="' + CV + '" stroke-width="2" opacity="0.2"/><path class="fl" d="' + pSE + '" stroke="' + CV + '" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>' : '') +
      (houseToEV ? '<path d="' + pHE + '" fill="none" stroke="' + CV + '" stroke-width="2" opacity="0.2"/><path class="fl" d="' + pHE + '" stroke="' + CV + '" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>' : '') +
      '<text x="' + solarX + '" y="' + (solarY-52) + '" text-anchor="middle" class="nl" font-size="13">Solar</text>' +
      '<circle cx="' + solarX + '" cy="' + solarY + '" r="47" fill="rgba(0,0,0,0.12)" stroke="' + CS + '" stroke-width="1.5" opacity="0.15"/>' +
      '<circle cx="' + solarX + '" cy="' + solarY + '" r="43" fill="rgba(0,0,0,0.55)" stroke="' + CS + '" stroke-width="2"/>' +
      '<text x="' + solarX + '" y="' + (solarY+7) + '" text-anchor="middle" class="nv" font-size="16" fill="' + CS + '">' + this._fmt(sw, solar.unit) + '</text>' +
      '<circle cx="' + gridX + '" cy="' + gridY + '" r="47" fill="rgba(0,0,0,0.12)" stroke="' + gc + '" stroke-width="1.5" opacity="0.15"/>' +
      '<circle cx="' + gridX + '" cy="' + gridY + '" r="43" fill="rgba(0,0,0,0.55)" stroke="' + gc + '" stroke-width="2"/>' +
      '<text x="' + gridX + '" y="' + (gridY-9) + '" text-anchor="middle" class="nv" font-size="12" fill="' + CE + '">' + outLabel + '</text>' +
      '<text x="' + gridX + '" y="' + (gridY+9) + '" text-anchor="middle" class="nv" font-size="12" fill="' + CI + '">' + inLabel + '</text>' +
      '<text x="' + gridX + '" y="' + (gridY+62) + '" text-anchor="middle" class="nl" font-size="13">Grid</text>' +
      '<circle cx="' + houseX + '" cy="' + houseY + '" r="47" fill="rgba(0,0,0,0.12)" stroke="' + CH + '" stroke-width="1.5" opacity="0.15"/>' +
      '<circle cx="' + houseX + '" cy="' + houseY + '" r="43" fill="rgba(0,0,0,0.55)" stroke="' + CH + '" stroke-width="2"/>' +
      '<text x="' + houseX + '" y="' + (houseY+7) + '" text-anchor="middle" class="nv" font-size="16" fill="' + CH + '">' + this._fmt(hw, home.unit) + '</text>' +
      '<text x="' + houseX + '" y="' + (houseY+62) + '" text-anchor="middle" class="nl" font-size="13">House</text>' +
      (evon ?
        '<text x="' + evX + '" y="' + (evY-50) + '" text-anchor="middle" class="nl" font-size="13">EV Charger</text>' +
        '<circle cx="' + evX + '" cy="' + evY + '" r="43" fill="rgba(0,0,0,0.12)" stroke="' + CV + '" stroke-width="1.5" opacity="0.15"/>' +
        '<circle cx="' + evX + '" cy="' + evY + '" r="39" fill="rgba(0,0,0,0.55)" stroke="' + CV + '" stroke-width="2"/>' +
        '<text x="' + evX + '" y="' + (evY+(evSubLabel?2:6)) + '" text-anchor="middle" class="nv" font-size="13" fill="' + CV + '">' + evLabel + '</text>' +
        (evSubLabel ? '<text x="' + evX + '" y="' + (evY+18) + '" text-anchor="middle" class="ns" font-size="10" fill="' + CV + '">' + evSubLabel + '</text>' : '')
      : '') +
      '</svg></div>';
  }

  getCardSize() { return 4; }
}

customElements.define('power-flow-custom', PowerFlowCustomCard);
