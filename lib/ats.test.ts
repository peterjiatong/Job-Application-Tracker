import { describe, expect, it } from 'vitest';
import { normalizeUrl, parseJobUrl } from './ats';

describe('normalizeUrl', () => {
  it('removes tracking params and the hash', () => {
    expect(
      normalizeUrl('https://jobs.lever.co/acme/abc?lever-source=LinkedIn&utm_medium=post#apply'),
    ).toBe('https://jobs.lever.co/acme/abc');
  });

  it('keeps unknown params and sorts them', () => {
    expect(normalizeUrl('https://example.com/jobs?b=2&utm_source=x&a=1')).toBe(
      'https://example.com/jobs?a=1&b=2',
    );
  });

  it('leaves a clean URL unchanged', () => {
    expect(normalizeUrl('https://boards.greenhouse.io/stripe/jobs/123')).toBe(
      'https://boards.greenhouse.io/stripe/jobs/123',
    );
  });

  it('returns null for invalid input', () => {
    expect(normalizeUrl('hello')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });

  it('returns null for non-http protocols', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});

// Job ids and base URLs come from each ATS's public job board API or search page (2026-11-10).
// Variants with tracking params, extra path segments, casing and EU hosts are derived from them.
describe('parseJobUrl', () => {
  const discord = { ats: 'greenhouse', company: 'discord', jobId: '8917177002' };
  const figma = { ats: 'greenhouse', company: 'figma', jobId: '5426468004' };
  const palantir = {
    ats: 'lever',
    company: 'palantir',
    jobId: '6ed76ce8-4156-4b60-b120-403538bd66cd',
  };
  const ramp = { ats: 'ashby', company: 'ramp', jobId: '34413f8d-26bf-4bbc-8ade-eb309a0e2245' };
  const servicenow = { ats: 'smartrecruiters', company: 'servicenow', jobId: '744000160989639' };
  const bosch = { ats: 'smartrecruiters', company: 'boschgroup', jobId: '744000161019279' };
  const huggingface = { ats: 'workable', company: 'huggingface', jobId: 'DB4D7C0EC8' };
  const peraton = { ats: 'icims', company: 'peraton', jobId: '173535' };
  const waters = { ats: 'icims', company: 'waters', jobId: '24651' };
  const nvidia = { ats: 'workday', company: 'nvidia', jobId: 'JR2026524' };
  const salesforce = { ats: 'workday', company: 'salesforce', jobId: 'JR366375' };
  const capitalone = { ats: 'workday', company: 'capitalone', jobId: 'R1005351' };
  const disney = { ats: 'workday', company: 'disney', jobId: '10160173' };

  it.each([
    // Greenhouse
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002', discord],
    ['https://boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004', figma],
    ['https://job-boards.greenhouse.io/figma/jobs/5426468004', figma],
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002?gh_src=abc&utm_source=linkedin#app', discord],
    ['https://job-boards.greenhouse.io/embed/job_app?for=discord&token=8917177002', discord],
    ['https://boards.greenhouse.io/embed/job_app?for=figma&token=5426468004', figma],
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002/confirmation', discord],
    ['https://job-boards.greenhouse.io/Discord/jobs/8917177002', discord],
    ['https://job-boards.eu.greenhouse.io/discord/jobs/8917177002', discord],
    // Lever
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd', palantir],
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply', palantir],
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply?lever-source=LinkedIn', palantir],
    ['https://jobs.lever.co/palantir/6ED76CE8-4156-4B60-B120-403538BD66CD', palantir],
    ['https://jobs.eu.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd', palantir],
    // Ashby
    ['https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245', ramp],
    ['https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application', ramp],
    ['https://jobs.ashbyhq.com/Ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245?utm_source=linkedin', ramp],
    // SmartRecruiters
    ['https://jobs.smartrecruiters.com/ServiceNow/744000160989639-staff-site-reliability-engineer-federal', servicenow],
    ['https://jobs.smartrecruiters.com/ServiceNow/744000160989639-staff-site-reliability-engineer-federal?oga=true', servicenow],
    ['https://jobs.smartrecruiters.com/ServiceNow/744000160989639', servicenow],
    ['https://jobs.smartrecruiters.com/BoschGroup/744000161019279--xc', bosch],
    // Workable
    ['https://apply.workable.com/huggingface/j/DB4D7C0EC8/', huggingface],
    ['https://apply.workable.com/huggingface/j/DB4D7C0EC8/apply/', huggingface],
    ['https://apply.workable.com/huggingface/j/db4d7c0ec8', huggingface],
    // iCIMS
    ['https://careers-peraton.icims.com/jobs/173535/customer-technical-specialist/job?in_iframe=1', peraton],
    ['https://careers-peraton.icims.com/jobs/173535/customer-technical-specialist/job', peraton],
    ['https://careers-peraton.icims.com/jobs/173535/login', peraton],
    ['https://uscareers-waters.icims.com/jobs/24651/2025-24651/job?in_iframe=1', waters],
    // Workday
    ['https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524', nvidia],
    ['https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524', nvidia],
    ['https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524?source=LinkedIn', nvidia],
    ['https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524/apply', nvidia],
    ['https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524/apply/autofillWithResume', nvidia],
    ['https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/details/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524', nvidia],
    ['https://wd5.myworkdaysite.com/recruiting/nvidia/NVIDIAExternalCareerSite/job/China-Shanghai/Manager--Silicon-Circuit-Co-Design---Silicon-Co-Design-Group_JR2026524', nvidia],
    ['https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/California---San-Francisco-Metro---Remote/Senior-Director--Content-Design---Slack_JR366375-2', salesforce],
    ['https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/Illinois---Chicago/Senior-Director--Content-Design---Slack_JR366375', salesforce],
    ['https://capitalone.wd12.myworkdayjobs.com/Capital_One/job/Plano-TX/Project-Manager--Principal-Associate--Social-innovation---Mobility-Forward-Focus-_R1005351-1', capitalone],
    ['https://disney.wd5.myworkdayjobs.com/disneycareer/job/New-York-NY-USA/Product-Software-Engineer-II_10160173', disney],
  ])('parses %s', (url, expected) => {
    expect(parseJobUrl(url)).toEqual(expected);
  });

  it.each([
    // Board list pages, not a single job
    'https://job-boards.greenhouse.io/discord',
    'https://jobs.lever.co/palantir',
    'https://jobs.ashbyhq.com/ramp',
    'https://jobs.smartrecruiters.com/ServiceNow',
    'https://apply.workable.com/huggingface/',
    'https://careers-peraton.icims.com/jobs/search?ss=1',
    'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite',
    'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/China-Shanghai',
    'https://wd5.myworkdaysite.com/recruiting/nvidia/NVIDIAExternalCareerSite',
    // SmartRecruiters apply flow uses a different id that cannot be mapped back
    'https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    // Malformed job ids
    'https://job-boards.greenhouse.io/discord/jobs/abc',
    'https://jobs.lever.co/palantir/not-a-uuid',
    // Look-alike and unrelated hosts
    'https://evil-greenhouse.io/discord/jobs/8917177002',
    'https://example.com/discord/jobs/8917177002',
    // Known limitation: Greenhouse jobs hosted on the company's own domain
    'https://stripe.com/jobs/search?gh_jid=8172510',
    // Not URLs
    'hello',
    '',
  ])('returns null for %s', (url) => {
    expect(parseJobUrl(url)).toBeNull();
  });
});
