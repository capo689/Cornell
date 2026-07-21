import { Injectable, Logger } from '@nestjs/common';

export interface WeatherSnapshot {
  source: 'Open-Meteo';
  live: boolean;
  location: string;
  temperatureF: number | null;
  apparentTemperatureF: number | null;
  highF: number | null;
  lowF: number | null;
  precipitationProbability: number | null;
  windMph: number | null;
  windGustMph: number | null;
  condition: string;
  observedAt: string | null;
  fetchedAt: string;
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cacheMs = 10 * 60 * 1000;
  private cache: { expiresAt: number; value: WeatherSnapshot } | null = null;

  async getWeather(): Promise<WeatherSnapshot> {
    if (this.cache && this.cache.expiresAt > Date.now())
      return this.cache.value;

    try {
      const parameters = new URLSearchParams({
        latitude: '42.444',
        longitude: '-76.478',
        current:
          'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m',
        daily:
          'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'America/New_York',
        forecast_days: '1',
      });
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${parameters.toString()}`,
        { signal: AbortSignal.timeout(3500) },
      );
      if (!response.ok)
        throw new Error(`Weather provider returned ${response.status}`);
      const payload = (await response.json()) as OpenMeteoResponse;
      const current = payload.current;
      if (!current || current.temperature_2m === undefined) {
        throw new Error('Weather provider response was incomplete');
      }
      const value: WeatherSnapshot = {
        source: 'Open-Meteo',
        live: true,
        location: 'Schoellkopf Field',
        temperatureF: Math.round(current.temperature_2m),
        apparentTemperatureF: this.round(current.apparent_temperature),
        highF: this.round(payload.daily?.temperature_2m_max?.[0]),
        lowF: this.round(payload.daily?.temperature_2m_min?.[0]),
        precipitationProbability: this.round(
          payload.daily?.precipitation_probability_max?.[0],
        ),
        windMph: this.round(current.wind_speed_10m),
        windGustMph: this.round(current.wind_gusts_10m),
        condition: this.describeWeather(current.weather_code),
        observedAt: current.time ?? null,
        fetchedAt: new Date().toISOString(),
      };
      this.cache = { expiresAt: Date.now() + this.cacheMs, value };
      return value;
    } catch (error) {
      this.logger.warn(
        `Live weather unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        source: 'Open-Meteo',
        live: false,
        location: 'Schoellkopf Field',
        temperatureF: null,
        apparentTemperatureF: null,
        highF: null,
        lowF: null,
        precipitationProbability: null,
        windMph: null,
        windGustMph: null,
        condition: 'Live conditions unavailable',
        observedAt: null,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  private round(value: number | undefined): number | null {
    return value === undefined ? null : Math.round(value);
  }

  private describeWeather(code: number | undefined): string {
    if (code === undefined) return 'Conditions available';
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    return 'Thunderstorms';
  }
}
