import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('starts in the coordinator command view', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h1')?.textContent ?? '';
    expect(heading).toContain('Homecoming');
    expect(heading).toContain('field show');
  });

  it('switches to the member itinerary', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.role-switch');
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('My itinerary');
  });
});
