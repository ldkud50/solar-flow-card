/**
 * Solar Flow Card v1.2.0
 * Animated solar power flow + daily stats for Home Assistant
 * https://github.com/ldkud50/solar-flow-card
 */

class SolarFlowCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.solar_entity) throw new Error('solar_entity is required');
    if (!config.home_entity)  throw new Error('home_entity is required');
    this._config = {
      // Flow card
      solar_entity:       config.solar_entity,
      home_entity:        config.home_entity,
      grid_import_entity: config.grid_import_entity || null,
      grid_export_entity: config.grid_export_entity || null,
      grid_net_entity:    config.grid_net_entity    || null,
      ev_entity:          config.ev_entity          || null,
      max_solar_kw:       config.max_solar_kw       || 10,
      font_scale:         config.font_scale         || 1,
      circle_scale:       config.circle_scale       || 1,
      background_image:   config.background_image   || null,
      grid_type:          config.grid_type          || 'separate',
      // Stat buttons row 1
      producing_entity:   config.producing_entity   || config.solar_entity,
      produced_entity:    config.produced_entity     || null,
      consuming_entity:   config.consuming_entity    || config.home_entity,
      consumed_entity:    config.consumed_entity     || null,
      solar_used_entity:  config.solar_used_entity   || null,
      // Stat buttons row 2
      importing_entity:   config.importing_entity    || config.grid_import_entity || null,
      imported_entity:    config.imported_entity     || null,
      exporting_entity:   config.exporting_entity    || config.grid_export_entity || null,
      exported_entity:    config.exported_entity     || null,
      solar_share_entity: config.solar_share_entity  || null,
      // Show/hide stats
      show_stats:         config.show_stats !== false,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _getState(entityId) {
    if (!entityId || !this._hass) return { val: 0, unit: 'W', state: '—' };
    const s = this._hass.states[entityId];
    if (!s) return { val: 0, unit: 'W', state: '—' };
    return {
      val:   parseFloat(s.state) || 0,
      unit:  s.attributes.unit_of_measurement || 'W',
      state: s.state,
    };
  }

  _toKw(val, unit) {
    return unit === 'kW' ? val : val / 1000;
  }

  _fmt(val, unit) {
    if (isNaN(val) || val === null) return '0 W';
    const kw = this._toKw(val, unit);
    return kw >= 1 ? kw.toFixed(1) + ' kW' : Math.round(kw * 1000) + ' W';
  }

  _fmtStat(entityId) {
    if (!entityId) return '—';
    const s = this._getState(entityId);
    if (s.state === '—') return '—';
    const unit = s.unit;
    if (unit === '%') return parseFloat(s.state).toFixed(1) + '%';
    if (unit === 'kWh') return parseFloat(s.state).toFixed(1) + ' kWh';
    if (unit === 'kW')  return parseFloat(s.state).toFixed(1) + ' kW';
    if (unit === 'W')   return parseFloat(s.state) >= 1000
      ? (parseFloat(s.state)/1000).toFixed(1) + ' kW'
      : Math.round(parseFloat(s.state)) + ' W';
    return s.state + (unit ? ' ' + unit : '');
  }

  _solarColor(val, unit) {
    const kw  = this._toKw(val, unit);
    const pct = kw / this._config.max_solar_kw;
    if (!kw || kw < 0.01) return '#555555';
    if (pct >= 0.99)      return '#ff1744';
    if (pct >= 0.95)      return '#ffd600';
    if (pct >= 0.60)      return '#ff9800';
    if (pct >= 0.25)      return '#ffa726';
    return '#00bfff';
  }

  _getGridValues() {
    const cfg = this._config;
    let importKw = 0, exportKw = 0;
    if (cfg.grid_type === 'separate') {
      const imp = this._getState(cfg.grid_import_entity);
      const exp = this._getState(cfg.grid_export_entity);
      importKw = this._toKw(imp.val, imp.unit);
      exportKw = this._toKw(exp.val, exp.unit);
    } else if (cfg.grid_type === 'net_meter') {
      const net = this._getState(cfg.grid_net_entity);
      const kw  = this._toKw(net.val, net.unit);
      importKw  = kw > 0 ? kw : 0;
      exportKw  = kw < 0 ? Math.abs(kw) : 0;
    } else if (cfg.grid_type === 'calculated') {
      const solar = this._getState(cfg.solar_entity);
      const home  = this._getState(cfg.home_entity);
      const net   = this._toKw(solar.val, solar.unit) - this._toKw(home.val, home.unit);
      exportKw    = net > 0 ? net : 0;
      importKw    = net < 0 ? Math.abs(net) : 0;
    }
    return { importKw, exportKw };
  }

  _statButton(entityId, label, color, icon) {
    const val = this._fmtStat(entityId);
    const C   = color;
    const sc  = this._config.font_scale || 1;
    const sz  = Math.round(16 * sc);
    return `
      <div class="stat-btn" style="border-color:${C};background:${C}14;">
        <div class="stat-shimmer" style="background:linear-gradient(90deg,transparent,${C}80,transparent)"></div>
        <svg viewBox="0 0 24 24" width="${sz}" height="${sz}" style="flex-shrink:0"><path d="${icon}" fill="${C}"/></svg>
        <div class="stat-val" style="color:${C}">${val}</div>
        <div class="stat-lbl">${label}</div>
      </div>
    `;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const cfg = this._config;
    const sc  = cfg.font_scale;
    const cs  = cfg.circle_scale;

    const solar = this._getState(cfg.solar_entity);
    const home  = this._getState(cfg.home_entity);
    const ev    = cfg.ev_entity ? this._getState(cfg.ev_entity) : { val: 0, unit: 'kWh' };

    const sw = solar.val, hw = home.val, evv = ev.val;
    const { importKw, exportKw } = this._getGridValues();

    const son   = this._toKw(sw, solar.unit) > 0.01;
    const isImp = importKw > 0.01;
    const isExp = exportKw > 0.01;
    const evon  = evv > 0.1;

    const CS = this._solarColor(sw, solar.unit);
    const CI = '#00bfff';
    const CE = '#00e676';
    const CH = '#a78bfa';
    const CV = '#ffd600';
    const CO = '#ff9800';
    const gc = isExp ? CE : CI;

    const solarX = 250, solarY = 95;
    const gridX  = 100, gridY  = 215;
    const houseX = 400, houseY = 215;
    const evX    = 420, evY    = 85;

    const rv = (base) => Math.round(base * cs);

    const pathSolarHouse = `M${solarX+22},${solarY+35} C${solarX+90},${solarY+120} ${houseX-60},${houseY-80} ${houseX},${houseY-40}`;
    const pathSolarGrid  = `M${solarX-22},${solarY+35} C${solarX-90},${solarY+120} ${gridX+60},${gridY-80} ${gridX},${gridY-40}`;
    const pathGridHouse  = `M${gridX+40},${gridY} L${houseX-40},${houseY}`;
    const pathHouseEV    = `M${houseX+10},${houseY-40} C${houseX+60},${houseY-130} ${evX-20},${evY+100} ${evX},${evY+36}`;

    const iSolar = 'M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.5,14.77 5.93,15.5C6.36,16.24 6.9,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.5,9.23 18.06,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.05,15.5C18.5,14.77 18.74,14 18.88,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.86,19 13.67,18.83 14.41,18.56L12,22Z';
    const iGrid  = 'M11,21H5V19L7,18V10L5,9V7H11V9L9,10V18L11,19V21M19,21H13V19L15,18V14L13,13V11H19V13L17,14V18L19,19V21M15,9V3H9V9H11V7H13V9H15Z';
    const iHouse = 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z';
    const iEV    = 'M15.5,5.5C16.33,5.5 17,4.83 17,4C17,3.17 16.33,2.5 15.5,2.5C14.67,2.5 14,3.17 14,4C14,4.83 14.67,5.5 15.5,5.5M5,12C3.9,12 3,12.9 3,14V20H5V22H9V20H15V22H19V20H21V14C21,12.9 20.1,12 19,12H17.45L15.68,7.85C15.29,6.97 14.38,6.5 13.47,6.71L7,8.5C6.08,8.79 5.5,9.67 5.5,10.64V12H5M7.5,10.65L13.5,9L15,12H7.5V10.65Z';
    const iFlash = 'M7,2V13H10V22L17,11H13L17,2H7Z';
    const iHome  = 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z';
    const iTower = 'M11,21H5V19L7,18V10L5,9V7H11V9L9,10V18L11,19V21M19,21H13V19L15,18V14L13,13V11H19V13L17,14V18L19,19V21M15,9V3H9V9H11V7H13V9H15Z';
    const iSolar2= 'M3.55,18.54L4.96,19.95L6.76,18.16L5.34,16.74M11,22.45C11.32,22.45 13,22.45 13,22.45V19.5H11M12,5.5A6,6 0 0,0 6,11.5A6,6 0 0,0 12,17.5A6,6 0 0,0 18,11.5C18,8.18 15.31,5.5 12,5.5M20,12.5H23V10.5H20M17.24,18.16L19.04,19.95L20.45,18.54L18.66,16.74M20.45,4.46L19.04,3.05L17.24,4.84L18.66,6.26M13,0.55H11V3.5H13M4,10.5H1V12.5H4M6.76,4.84L4.96,3.05L3.55,4.46L5.34,6.26L6.76,4.84Z';
    const iShare = 'M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,6A2,2 0 0,1 12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6M10,18A2,2 0 0,1 12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18M15.1,7.4L13.4,8.35M13.4,13.65L15.1,14.6M8.9,13.65L7.2,14.6M8.9,10.35L7.2,9.4';

    const node = (cx, cy, rb, color, active, iconD, iconSize, valLines, label, labelAbove) => {
      const r  = rv(rb);
      const si = iconSize * sc;
      const io = valLines.length === 2 ? -8 : -6;
      return `
        <circle cx="${cx}" cy="${cy}" r="${r+4}" fill="rgba(0,0,0,0.12)" stroke="${color}" stroke-width="1.5" opacity="0.12"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.6)" stroke="${color}" stroke-width="1.8"/>
        ${active ? `<circle cx="${cx}" cy="${cy}" r="${r+9}" fill="none" stroke="${color}" stroke-width="1" class="rp"/>` : ''}
        <g transform="translate(${cx-si/2},${cy+io-si}) scale(${si/24})">
          <path d="${iconD}" fill="${color}"/>
        </g>
        ${valLines.map((l,i)=>`
          <text x="${cx}" y="${cy+io+(i*14*sc)+14*sc}" text-anchor="middle" class="nv" font-size="${(l.size||13)*sc}" fill="${l.color||color}">${l.text}</text>
        `).join('')}
        ${labelAbove
          ? `<text x="${cx}" y="${cy-r-10}" text-anchor="middle" class="nl" font-size="${11*sc}">${label}</text>`
          : `<text x="${cx}" y="${cy+r+16}" text-anchor="middle" class="nl" font-size="${11*sc}">${label}</text>`}
      `;
    };

    const expStr = exportKw >= 1 ? exportKw.toFixed(1)+' kW' : Math.round(exportKw*1000)+' W';
    const impStr = importKw >= 1 ? importKw.toFixed(1)+' kW' : Math.round(importKw*1000)+' W';
    const bg = cfg.background_image
      ? `background-image:url('${cfg.background_image}');background-size:cover;background-position:center 42%;`
      : `background:linear-gradient(135deg,#0f1923 0%,#1a2a1a 50%,#0f1923 100%);`;

    const stats = cfg.show_stats ? `
      <div class="stats">
        <div class="stats-row">
          ${this._statButton(cfg.producing_entity,  'Producing',   CO, iFlash)}
          ${this._statButton(cfg.produced_entity,   'Produced',    CI, iSolar2)}
          ${this._statButton(cfg.consuming_entity,  'Consuming',   CO, iFlash)}
          ${this._statButton(cfg.consumed_entity,   'Consumed',    CI, iHome)}
          ${this._statButton(cfg.solar_used_entity, 'Solar Used',  CE, iShare)}
        </div>
        <div class="stats-row">
          ${this._statButton(cfg.importing_entity,  'Importing',   CO, iTower)}
          ${this._statButton(cfg.imported_entity,   'Imported',    CI, iTower)}
          ${this._statButton(cfg.exporting_entity,  'Exporting',   CO, iTower)}
          ${this._statButton(cfg.exported_entity,   'Exported',    CI, iTower)}
          ${this._statButton(cfg.solar_share_entity,'Solar Share', CE, iShare)}
        </div>
      </div>
    ` : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;width:100%;border-radius:12px;overflow:hidden;}
        .wrap{border-radius:12px;overflow:hidden;background:#111;}
        .flow{position:relative;width:100%;height:300px;${bg}border-radius:12px 12px 0 0;overflow:hidden;box-sizing:border-box;}
        .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.72);border-radius:12px 12px 0 0;}
        svg{position:absolute;inset:0;width:100%;height:100%;}
        .nv{font-weight:700;font-family:var(--primary-font-family,sans-serif);}
        .nl{font-weight:600;fill:rgba(255,255,255,0.85);font-family:var(--primary-font-family,sans-serif);}
        .fl{fill:none;stroke-dasharray:10 6;animation-timing-function:linear;animation-iteration-count:infinite;animation-duration:2.5s;}
        .rp{animation:rp 2s ease-in-out infinite;}
        @keyframes dash-fwd{0%{stroke-dashoffset:300}100%{stroke-dashoffset:0}}
        @keyframes dash-rev{0%{stroke-dashoffset:0}100%{stroke-dashoffset:300}}
        @keyframes rp{0%,100%{opacity:0.15}50%{opacity:0.6}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}

        .stats{padding:3px 3px 5px;display:flex;flex-direction:column;gap:3px;background:rgba(0,0,0,0.3);}
        .stats-row{display:flex;gap:3px;}
        .stat-btn{
          flex:1;border-radius:8px;border:1px solid;
          padding:5px 3px 4px;display:flex;flex-direction:column;
          align-items:center;gap:2px;position:relative;overflow:hidden;
          box-sizing:border-box;min-width:0;
        }
        .stat-shimmer{
          position:absolute;top:0;left:0;right:0;height:1px;
          animation:shimmer 2.5s linear infinite;pointer-events:none;
        }
        .stat-val{font-size:${0.7 * sc}em;font-weight:700;font-family:var(--primary-font-family,sans-serif);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
        .stat-lbl{font-size:${0.58 * sc}em;color:rgba(255,255,255,0.65);font-family:var(--primary-font-family,sans-serif);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
      </style>
      <div class="wrap">
        <div class="flow">
          <div class="overlay"></div>
          <svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">

            <path d="${pathGridHouse}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"/>
            ${isImp ? `
              <path d="${pathGridHouse}" fill="none" stroke="${CI}" stroke-width="2.5" opacity="0.4"/>
              <path class="fl" d="${pathGridHouse}" stroke="${CI}" stroke-width="2.5" stroke-dashoffset="300" style="animation-name:dash-fwd"/>
            ` : ''}
            ${isExp && !son ? `
              <path d="${pathGridHouse}" fill="none" stroke="${CE}" stroke-width="2.5" opacity="0.4"/>
              <path class="fl" d="${pathGridHouse}" stroke="${CE}" stroke-width="2.5" style="animation-name:dash-rev"/>
            ` : ''}
            ${son ? `
              <path d="${pathSolarHouse}" fill="none" stroke="${CS}" stroke-width="2" opacity="0.25"/>
              <path class="fl" d="${pathSolarHouse}" stroke="${CS}" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>
            ` : ''}
            ${son && isExp ? `
              <path d="${pathSolarGrid}" fill="none" stroke="${CE}" stroke-width="2" opacity="0.25"/>
              <path class="fl" d="${pathSolarGrid}" stroke="${CE}" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>
            ` : ''}
            ${evon ? `
              <path d="${pathHouseEV}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"/>
              <path d="${pathHouseEV}" fill="none" stroke="${CV}" stroke-width="2" opacity="0.25"/>
              <path class="fl" d="${pathHouseEV}" stroke="${CV}" stroke-width="2" stroke-dashoffset="300" style="animation-name:dash-fwd"/>
            ` : ''}

            ${node(solarX,solarY,40,CS,son,iSolar,20,[{text:this._fmt(sw,solar.unit),size:13}],'Solar',true)}
            ${node(gridX,gridY,40,gc,isImp||isExp,iGrid,18,
              [{text:'Out: '+expStr,size:10,color:CE},{text:'In: '+impStr,size:10,color:CI}],
              'Grid',false)}
            ${node(houseX,houseY,40,CH,true,iHouse,20,[{text:this._fmt(hw,home.unit),size:13}],'House',false)}
            ${evon ? node(evX,evY,36,CV,true,iEV,18,[{text:evv.toFixed(1)+' kWh',size:11}],'EV Charger',true) : ''}

          </svg>
        </div>
        ${stats}
      </div>
    `;
  }

  getCardSize() { return this._config.show_stats !== false ? 7 : 4; }
}

// ─── VISUAL EDITOR ───────────────────────────────────────────────────────────
class SolarFlowCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._page = 'flow';
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) { this._hass = hass; }

  _fire(config) {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  _changed(e) {
    const key = e.target.dataset.key;
    if (!key) return;
    let val = e.target.type === 'number' ? parseFloat(e.target.value) :
              e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    this._config = { ...this._config, [key]: val };
    this._fire(this._config);
    if (key === 'grid_type') this._render();
  }

  _setPage(p) { this._page = p; this._render(); }

  _render() {
    const c  = this._config;
    const gt = c.grid_type || 'separate';
    const p  = this._page;

    const tab = (id, label) =>
      `<button class="tab ${p===id?'active':''}" data-page="${id}">${label}</button>`;

    const row = (key, label, placeholder, hint='', type='text') => `
      <div class="row">
        <label>${label}</label>
        <input data-key="${key}" type="${type}" value="${c[key]||''}" placeholder="${placeholder}"
          ${type==='number'?`step="0.1"`:''}/>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </div>`;

    const numrow = (key, label, def, min, max, step, hint='') => `
      <div class="row">
        <label>${label}</label>
        <input data-key="${key}" type="number" value="${c[key]!==undefined?c[key]:def}"
          min="${min}" max="${max}" step="${step}"/>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </div>`;

    const flowPage = `
      <div class="section">Required Entities</div>
      ${row('solar_entity','Solar Production *','sensor.solar_production','Current solar output (W or kW)')}
      ${row('home_entity','Home Consumption *','sensor.home_consumption','Current home consumption (W or kW)')}

      <div class="section">Grid Setup</div>
      <div class="row">
        <label>Grid Type</label>
        <select data-key="grid_type">
          <option value="separate" ${gt==='separate'?'selected':''}>Separate Import/Export Sensors</option>
          <option value="net_meter" ${gt==='net_meter'?'selected':''}>Single Net Meter</option>
          <option value="calculated" ${gt==='calculated'?'selected':''}>Calculate from Solar &amp; Home</option>
        </select>
      </div>
      ${gt==='separate'?`
        <div class="info">Common with Enphase, SolarEdge, smart meters.</div>
        ${row('grid_import_entity','Grid Import Sensor','sensor.grid_import_power')}
        ${row('grid_export_entity','Grid Export Sensor','sensor.grid_export_power')}
      `:''}
      ${gt==='net_meter'?`
        <div class="info">Positive = importing, negative = exporting.</div>
        ${row('grid_net_entity','Net Grid Sensor','sensor.grid_power_net')}
      `:''}
      ${gt==='calculated'?`<div class="info">Calculated from Solar minus Home. No grid sensor needed.</div>`:''}

      <div class="section">Optional</div>
      ${row('ev_entity','EV Charger Sensor','sensor.ev_charger_energy_today','Energy used today (kWh). Hidden when zero.')}
    `;

    const statsPage = `
      <div class="section">Row 1 — Current Power &amp; Today</div>
      ${row('producing_entity','Producing (current solar W/kW)','sensor.solar_production','Defaults to solar_entity if blank')}
      ${row('produced_entity','Produced (solar kWh today)','sensor.solar_energy_today')}
      ${row('consuming_entity','Consuming (current home W/kW)','sensor.home_consumption','Defaults to home_entity if blank')}
      ${row('consumed_entity','Consumed (home kWh today)','sensor.home_energy_today')}
      ${row('solar_used_entity','Solar Used (self-consumption %)','sensor.solar_self_consumption_rate')}

      <div class="section">Row 2 — Grid Today</div>
      ${row('importing_entity','Importing (current grid import W/kW)','sensor.grid_import_power','Defaults to grid_import_entity if blank')}
      ${row('imported_entity','Imported (grid import kWh today)','sensor.grid_import_today')}
      ${row('exporting_entity','Exporting (current grid export W/kW)','sensor.grid_export_power','Defaults to grid_export_entity if blank')}
      ${row('exported_entity','Exported (grid export kWh today)','sensor.grid_export_today')}
      ${row('solar_share_entity','Solar Share (solar coverage %)','sensor.solar_coverage_rate')}

      <div class="section">Visibility</div>
      <div class="row checkbox-row">
        <label>Show Stats Buttons</label>
        <input type="checkbox" data-key="show_stats" ${c.show_stats!==false?'checked':''}/>
      </div>
    `;

    const appearPage = `
      <div class="section">Appearance</div>
      ${row('background_image','Background Image','/local/house.jpg','Path in /config/www/ — leave blank for dark gradient')}
      ${numrow('max_solar_kw','Max Solar Capacity (kW)',10,1,50,0.1,'Used for solar node color scaling')}
      ${numrow('font_scale','Font Scale',1,0.5,2,0.1,'1.0 = default. Increase for mobile (e.g. 1.4)')}
      ${numrow('circle_scale','Circle Scale',1,0.5,2,0.05,'1.0 = default. Increase node size (e.g. 1.25)')}
    `;

    this.shadowRoot.innerHTML = `
      <style>
        .tabs{display:flex;gap:4px;padding:12px 16px 0;border-bottom:1px solid var(--divider-color);}
        .tab{flex:1;padding:6px;border:none;border-radius:6px 6px 0 0;background:none;color:var(--secondary-text-color);font-size:12px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;}
        .tab.active{background:var(--primary-color);color:#fff;}
        .form{display:flex;flex-direction:column;gap:10px;padding:14px 16px;}
        .section{font-weight:700;font-size:11px;color:var(--primary-color);text-transform:uppercase;letter-spacing:1px;margin-top:6px;border-bottom:1px solid var(--divider-color);padding-bottom:3px;}
        .row{display:flex;flex-direction:column;gap:3px;}
        .checkbox-row{flex-direction:row;align-items:center;justify-content:space-between;}
        .checkbox-row input{width:auto;}
        label{font-size:12px;color:var(--secondary-text-color);font-weight:500;}
        input,select{width:100%;padding:7px 10px;border-radius:8px;box-sizing:border-box;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font-size:13px;}
        .hint{font-size:11px;color:var(--secondary-text-color);}
        .info{font-size:11px;color:var(--secondary-text-color);padding:6px 8px;background:rgba(var(--rgb-primary-color),0.08);border-radius:6px;}
      </style>
      <div class="tabs">
        ${tab('flow','Flow Card')}
        ${tab('stats','Stat Buttons')}
        ${tab('appear','Appearance')}
      </div>
      <div class="form">
        ${p==='flow' ? flowPage : p==='stats' ? statsPage : appearPage}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('change', this._changed.bind(this));
      el.addEventListener('input',  this._changed.bind(this));
    });
    this.shadowRoot.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => this._setPage(btn.dataset.page));
    });
  }
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
customElements.define('solar-flow-card',        SolarFlowCard);
customElements.define('solar-flow-card-editor', SolarFlowCardEditor);

SolarFlowCard.cardType   = 'solar-flow-card';
SolarFlowCard.cardName   = 'Solar Flow Card';
SolarFlowCard.cardEditor = 'solar-flow-card-editor';

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'solar-flow-card',
  name:        'Solar Flow Card',
  description: 'Animated solar power flow + daily stats with dynamic colors, live grid direction, EV support, and visual editor.',
  preview:     true,
  documentationURL: 'https://github.com/ldkud50/solar-flow-card',
});

console.info(
  '%c SOLAR-FLOW-CARD %c v1.2.0 ',
  'background:#ff9800;color:#000;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#222;color:#ff9800;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0'
);
