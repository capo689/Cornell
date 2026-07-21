import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

type Role = 'coordinator' | 'member';
type View = 'command' | 'people' | 'repertoire' | 'equipment' | 'operations';

@Component({
  selector: 'app-root',
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  readonly role = signal<Role>('coordinator');
  readonly view = signal<View>('command');
  readonly absenceResolved = signal(false);
  readonly published = signal(false);
  readonly acknowledged = signal(false);
  readonly jobs = signal([
    { label: 'Weather sync', state: 'Complete', time: '2 min ago' },
    { label: 'Roster validation', state: 'Complete', time: '8 min ago' },
  ]);
  readonly apiConnected = signal(false);

  readonly readiness = computed(() => {
    if (this.acknowledged()) return 100;
    if (this.published()) return 94;
    if (this.absenceResolved()) return 91;
    return 82;
  });

  readonly issues = computed(() => (this.absenceResolved() ? 1 : 3));

  ngOnInit(): void {
    this.http.get<DemoState>('/api/demo/state').subscribe({
      next: (state) => this.applyState(state),
      error: () => this.apiConnected.set(false),
    });
  }

  selectView(view: View): void {
    this.view.set(view);
  }

  switchRole(): void {
    this.role.update((role) => (role === 'coordinator' ? 'member' : 'coordinator'));
    this.view.set('command');
  }

  resolveAbsence(): void {
    this.absenceResolved.set(true);
    this.postCoordinator('/api/demo/resolve-absence');
  }

  publishRevision(): void {
    this.published.set(true);
    this.jobs.set([
      { label: 'Event packet · rev 4', state: 'Complete', time: 'just now' },
      { label: 'Member notifications', state: 'Complete', time: 'just now' },
      { label: 'Readiness recalculation', state: 'Complete', time: 'just now' },
      ...this.jobs(),
    ]);
    this.postCoordinator('/api/demo/publish');
  }

  acknowledge(): void {
    this.acknowledged.set(true);
    this.http.post('/api/demo/acknowledge', {}, { headers: new HttpHeaders({ 'x-demo-user': 'Jordan Lee' }) }).subscribe({
      next: () => this.refreshState(),
      error: () => this.apiConnected.set(false),
    });
  }

  private postCoordinator(path: string): void {
    const headers = new HttpHeaders({ 'x-demo-role': 'coordinator', 'x-demo-user': 'Maya Chen' });
    this.http.post(path, {}, { headers }).subscribe({
      next: () => this.refreshState(),
      error: () => this.apiConnected.set(false),
    });
  }

  private refreshState(): void {
    this.http.get<DemoState>('/api/demo/state').subscribe({ next: (state) => this.applyState(state) });
  }

  private applyState(state: DemoState): void {
    this.apiConnected.set(true);
    this.absenceResolved.set(state.event.absenceResolved);
    this.published.set(state.event.published);
    this.acknowledged.set(state.event.acknowledged);
    if (state.jobs.length) {
      this.jobs.set(state.jobs.map((job) => ({ label: job.type.replaceAll('_', ' ').toLowerCase(), state: job.state, time: 'server' })));
    }
  }
}

interface DemoState {
  event: { absenceResolved: boolean; published: boolean; acknowledged: boolean };
  jobs: Array<{ type: string; state: string }>;
}
