import { Routes } from '@angular/router';
import { authGuard, guestGuard, landingGuard, mentorGuard, staffGuard } from './core/guards';


export const routes: Routes = [
  // ---- public : on decouvre et on choisit sans compte ----
  { path: '', pathMatch: 'full', canActivate: [landingGuard], loadComponent: () => import('./pages/landing.page').then((m) => m.LandingPage) },
  { path: 'catalogue', loadComponent: () => import('./pages/catalog.page').then((m) => m.CatalogPage) },
  { path: 'cours/:id', loadComponent: () => import('./pages/course.page').then((m) => m.CoursePage) },
  { path: 'formations/:id', loadComponent: () => import('./pages/formation.page').then((m) => m.FormationPage) },
  // ---- inscription puis apprentissage lineaire ----
  { path: 'paiement/:kind/:id', canActivate: [authGuard], loadComponent: () => import('./pages/checkout.page').then((m) => m.CheckoutPage) },
  { path: 'apprendre/:id', canActivate: [authGuard], loadComponent: () => import('./pages/player.page').then((m) => m.PlayerPage) },
  { path: 'apprendre/:id/:step', canActivate: [authGuard], loadComponent: () => import('./pages/player.page').then((m) => m.PlayerPage) },
  // anciennes adresses
  { path: 'modules', redirectTo: 'catalogue' },
  { path: 'modules/:id', redirectTo: 'cours/:id' },
  { path: 'modules/:id/reprendre', redirectTo: 'apprendre/:id' },
  { path: 'modules/:id/lecon/:lessonId', redirectTo: 'apprendre/:id' },
  { path: 'modules/:id/evaluation', redirectTo: 'apprendre/:id/evaluation' },
  { path: 'parcours', redirectTo: 'accueil' },
  { path: 'parcours/:id', redirectTo: 'formations/:id' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage) },
  { path: 'inscription', canActivate: [guestGuard], loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage) },
  { path: 'verifier/:code', loadComponent: () => import('./pages/verify.page').then((m) => m.VerifyPage) },
  { path: 'bienvenue', canActivate: [authGuard], loadComponent: () => import('./pages/placement.page').then((m) => m.PlacementPage) },
  { path: 'accueil', canActivate: [authGuard], loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
  { path: 'classes/:id', canActivate: [authGuard], loadComponent: () => import('./pages/classroom.page').then((m) => m.ClassroomPage) },
  { path: 'fiches', canActivate: [authGuard], loadComponent: () => import('./pages/resources.page').then((m) => m.ResourcesPage) },
  { path: 'fiches/:id', canActivate: [authGuard], loadComponent: () => import('./pages/resources.page').then((m) => m.ResourcesPage) },
  { path: 'mon-ecole', canActivate: [authGuard], loadComponent: () => import('./pages/school.page').then((m) => m.SchoolPage) },
  { path: 'certificats', canActivate: [authGuard], loadComponent: () => import('./pages/certificates.page').then((m) => m.CertificatesPage) },
  { path: 'communaute', canActivate: [authGuard], loadComponent: () => import('./pages/community.page').then((m) => m.CommunityPage) },
  { path: 'communaute/:id', canActivate: [authGuard], loadComponent: () => import('./pages/thread.page').then((m) => m.ThreadPage) },
  { path: 'profil', canActivate: [authGuard], loadComponent: () => import('./pages/profile.page').then((m) => m.ProfilePage) },
  { path: 'mentorat', canActivate: [mentorGuard], loadComponent: () => import('./pages/mentor.page').then((m) => m.MentorPage) },
  { path: 'admin', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'admin/modules', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/modules.page').then((m) => m.AdminModulesPage) },
  { path: 'admin/modules/:id', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/course-editor.page').then((m) => m.CourseEditorPage) },
  { path: 'admin/modules/:id/analyse', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/insights.page').then((m) => m.InsightsPage) },
  { path: 'admin/programmes', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/programs-admin.page').then((m) => m.ProgramsAdminPage) },
  { path: 'admin/programmes/:id', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/programs-admin.page').then((m) => m.ProgramEditorPage) },
  { path: 'admin/classes', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/classrooms-admin.page').then((m) => m.ClassroomsAdminPage) },
  { path: 'admin/classes/:id', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/classrooms-admin.page').then((m) => m.ClassroomEditorPage) },
  { path: 'admin/referentiels', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/referentials.page').then((m) => m.ReferentialsPage) },
  { path: 'admin/apprenants', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/learners.page').then((m) => m.LearnersPage) },
  { path: 'admin/ia', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/ai-supervision.page').then((m) => m.AiSupervisionPage) },
  { path: '**', redirectTo: '' },
];
