module.exports = function (homebridge) {
  homebridge.registerAccessory('homebridge-synology-surveillance-homemode', 'HomeMode', HomeMode)
}

const infoApi = 'SYNO.API.Info'
const authApi = 'SYNO.API.Auth'
const homeModeApi = 'SYNO.SurveillanceStation.HomeMode'

class HomeMode {
  constructor(log, config, api) {
    this.log = log

    this.name = config.name || 'Home Mode'
    this.host = config.host
    this.username = config.username || ''
    this.password = config.password || ''

    this.infoPromise = this.getInfo()
    this.sidPromise = this.getSid()

    this.service = new api.hap.Service.Switch(this.name)
    this.service
      .getCharacteristic(api.hap.Characteristic.On)
      .onGet(() => this.getState())
      .onSet(state => {
        this.setState(state)
      })
  }

  // Required by homebridge API
  getServices() {
    return [this.service]
  }

  // Should return boolean state of HomeMode
  async getState() {
    try {
      const info = await this.infoPromise
      const spec = info[homeModeApi]
      const sid = await this.sidPromise

      const url = this.createURL(spec.path, {
        api: homeModeApi,
        method: 'GetInfo',
        version: spec.maxVersion,
        _sid: sid,
      })

      const response = await this.json(url)
      return response?.data?.on
    } catch (e) {
      this.log.error(e)
      return false
    }
  }

  // Changes state of HomeMode.
  // state is boolean
  async setState(state) {
    try {
      const info = await this.infoPromise
      const spec = info[homeModeApi]
      const sid = await this.sidPromise

      const url = this.createURL(spec.path, {
        api: homeModeApi,
        method: 'Switch',
        version: spec.maxVersion,
        on: state,
        _sid: sid,
      })

      const response = await this.json(url)
      return response?.data?.on
    } catch (e) {
      this.log.error(e)
      return false
    }
  }

  // Build URL to call syno API
  createURL(path, params) {
    const u = new URL(this.host)
    u.pathname = 'webapi/' + path
    u.search = new URLSearchParams({
      ...params,
    })
    return u.toString()
  }

  // Returns session ID to use in other endpoints
  async getSid() {
    const info = await this.infoPromise
    const spec = info[authApi]

    const url = this.createURL(spec.path, {
      api: authApi,
      method: 'login',
      version: spec.maxVersion,
      account: this.username,
      passwd: this.password,
      session: 'SurveillanceStation',
      format: 'sid',
    })

    const response = await this.json(url)
    return response.data.sid
  }

  // Returns info about API endpoints
  async getInfo() {
    const url = this.createURL('query.cgi', {
      api: infoApi,
      method: 'Query',
      query: [authApi, homeModeApi].join(','),
      version: 1,
    })
    const result = await this.json(url)

    if (!result.data) {
      this.log.error('Unable to fetch info from synology api', result)
      throw new Error('Unable to get info from synology')
    }

    return result.data
  }

  // Fetches JSON resource
  async json(...args) {
    const response = await fetch(...args)
    return response.json()
  }
}
