import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Observable } from 'rxjs';

type Role = 'coordinator' | 'member';
type View = 'command' | 'people' | 'repertoire' | 'equipment' | 'operations';
type MemberView = 'week' | 'music' | 'equipment';

interface Member {
  id: string;
  name: string;
  section: string;
  instrument: string;
  available: boolean;
  qualifiedParts: string[];
  busAssignment: string | null;
  status: string;
}

interface RepertoireItem {
  id: string;
  title: string;
  artist: string;
  position: number;
  coverageStatus: string;
  duration: string;
  missingParts: number;
}

interface Instrument {
  id: string;
  assetTag: string;
  type: string;
  assignee: string | null;
  status: string;
  condition: string;
  note: string | null;
}

interface DemoState {
  event: {
    absenceResolved: boolean;
    published: boolean;
    acknowledged: boolean;
    substituteName: string | null;
    revision: number;
  };
  readiness: number;
  issues: number;
  members: Member[];
  repertoire: RepertoireItem[];
  instruments: Instrument[];
  jobs: Array<{ id: string; type: string; state: string; createdAt: string }>;
  audit: Array<{ id: string; actor: string; action: string; detail: string; createdAt: string }>;
  weather: WeatherSnapshot;
}

interface WeatherSnapshot {
  source: string;
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly coordinatorHeaders = new HttpHeaders({
    'x-demo-role': 'coordinator',
    'x-demo-user': 'Maya Chen',
  });

  readonly role = signal<Role>('coordinator');
  readonly view = signal<View>('command');
  readonly memberView = signal<MemberView>('week');
  readonly absenceResolved = signal(false);
  readonly published = signal(false);
  readonly acknowledged = signal(false);
  readonly readiness = signal(82);
  readonly issues = signal(3);
  readonly members = signal<Member[]>([]);
  readonly repertoire = signal<RepertoireItem[]>([]);
  readonly instruments = signal<Instrument[]>([]);
  readonly jobs = signal<DemoState['jobs']>([]);
  readonly audit = signal<DemoState['audit']>([]);
  readonly weather = signal<WeatherSnapshot>({
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
    condition: 'Loading live conditions…',
    observedAt: null,
    fetchedAt: '',
  });
  readonly apiConnected = signal(false);
  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly search = signal('');
  readonly modal = signal<'packet' | 'substitute' | 'acknowledgments' | null>(null);

  readonly filteredMembers = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.members().filter((member) =>
      !query || `${member.name} ${member.section} ${member.instrument}`.toLowerCase().includes(query),
    );
  });

  readonly substituteCandidates = computed(() =>
    this.members().filter(
      (member) => member.available && member.qualifiedParts.includes('tenor-sax-part-2'),
    ),
  );

  readonly memberInstrument = computed(() =>
    this.instruments().find((instrument) => instrument.assignee === 'Jordan Lee'),
  );

  ngOnInit(): void {
    this.refreshState();
  }

  selectView(view: View): void {
    this.view.set(view);
  }

  selectMemberView(view: MemberView): void {
    this.memberView.set(view);
  }

  switchRole(): void {
    this.role.update((role) => (role === 'coordinator' ? 'member' : 'coordinator'));
    this.view.set('command');
    this.memberView.set('week');
  }

  setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  openModal(modal: 'packet' | 'substitute' | 'acknowledgments'): void {
    this.modal.set(modal);
  }

  closeModal(): void {
    this.modal.set(null);
  }

  resolveAbsence(memberId: string): void {
    this.mutate('assign', () =>
      this.http.post('/api/demo/resolve-absence', { memberId }, { headers: this.coordinatorHeaders }),
    );
  }

  publishRevision(): void {
    this.mutate('publish', () =>
      this.http.post('/api/demo/publish', {}, { headers: this.coordinatorHeaders }),
    );
  }

  acknowledge(): void {
    this.mutate('acknowledge', () =>
      this.http.post('/api/demo/acknowledge', {}, {
        headers: new HttpHeaders({ 'x-demo-user': 'Jordan Lee' }),
      }),
    );
  }

  toggleAvailability(member: Member): void {
    this.mutate(`member-${member.id}`, () =>
      this.http.patch(
        `/api/demo/members/${member.id}/availability`,
        { available: !member.available },
        { headers: this.coordinatorHeaders },
      ),
    );
  }

  moveRepertoire(item: RepertoireItem, direction: -1 | 1): void {
    const order = [...this.repertoire()];
    const index = order.findIndex((candidate) => candidate.id === item.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    this.mutate(`music-${item.id}`, () =>
      this.http.put(
        '/api/demo/repertoire/order',
        { itemIds: order.map((candidate) => candidate.id) },
        { headers: this.coordinatorHeaders },
      ),
    );
  }

  cycleCondition(instrument: Instrument): void {
    const next = instrument.condition === 'good' ? 'attention' : instrument.condition === 'attention' ? 'repair' : 'good';
    const note = next === 'good' ? '' : next === 'attention' ? 'Inspect before Saturday call time.' : 'Hold from service pending repair.';
    this.mutate(`gear-${instrument.id}`, () =>
      this.http.patch(
        `/api/demo/instruments/${instrument.id}/condition`,
        { condition: next, note },
        { headers: this.coordinatorHeaders },
      ),
    );
  }

  resetDemo(): void {
    this.mutate('reset', () =>
      this.http.post('/api/demo/reset', {}, { headers: this.coordinatorHeaders }),
    );
  }

  printPacket(): void {
    window.print();
  }

  private mutate(key: string, request: () => Observable<unknown>): void {
    this.busy.set(key);
    this.errorMessage.set('');
    request().subscribe({
      next: () => {
        this.modal.set(null);
        this.refreshState();
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(null);
        this.apiConnected.set(false);
        this.errorMessage.set(error.error?.message ?? 'That action could not be completed. Try again.');
      },
    });
  }

  private refreshState(): void {
    this.loading.set(true);
    this.http.get<DemoState>('/api/demo/state').subscribe({
      next: (state) => this.applyState(state),
      error: () => {
        this.loading.set(false);
        this.busy.set(null);
        this.apiConnected.set(false);
        this.errorMessage.set('Bandboard API is unavailable. Start the local stack and retry.');
      },
    });
  }

  private applyState(state: DemoState): void {
    this.apiConnected.set(true);
    this.loading.set(false);
    this.busy.set(null);
    this.errorMessage.set('');
    this.absenceResolved.set(state.event.absenceResolved);
    this.published.set(state.event.published);
    this.acknowledged.set(state.event.acknowledged);
    this.readiness.set(state.readiness);
    this.issues.set(state.issues);
    this.members.set(state.members);
    this.repertoire.set(state.repertoire);
    this.instruments.set(state.instruments);
    this.jobs.set(state.jobs);
    this.audit.set(state.audit);
    this.weather.set(state.weather);
  }
}
