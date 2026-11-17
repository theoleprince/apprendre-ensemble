import { Routes } from '@angular/router';
import { authGuard, guestGuard, mentorGuard, staffGuard } from './core/guards';


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accueil' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage) },
  { path: 'inscription', canActivate: [guestGuard], loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage) },
  { path: 'verifier/:code', loadComponent: () => import('./pages/verify.page').then((m) => m.VerifyPage) },
  { path: 'bienvenue', canActivate: [authGuard], loadComponent: () => import('./pages/placement.page').then((m) => m.PlacementPage) },
  { path: 'accueil', canActivate: [authGuard], loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
  { path: 'modules', canActivate: [authGuard], loadComponent: () => import('./pages/catalog.page').then((m) => m.CatalogPage) },
  { path: 'modules/:id', canActivate: [authGuard], loadComponent: () => import('./pages/module.page').then((m) => m.ModulePage) },
  { path: 'modules/:id/lecon/:lessonId', canActivate: [authGuard], loadComponent: () => import('./pages/lesson.page').then((m) => m.LessonPage) },
  { path: 'modules/:id/evaluation', canActivate: [authGuard], loadComponent: () => import('./pages/quiz.page').then((m) => m.QuizPage) },
  { path: 'certificats', canActivate: [authGuard], loadComponent: () => import('./pages/certificates.page').then((m) => m.CertificatesPage) },
  { path: 'communaute', canActivate: [authGuard], loadComponent: () => import('./pages/community.page').then((m) => m.CommunityPage) },
  { path: 'communaute/:id', canActivate: [authGuard], loadComponent: () => import('./pages/thread.page').then((m) => m.ThreadPage) },
  { path: 'profil', canActivate: [authGuard], loadComponent: () => import('./pages/profile.page').then((m) => m.ProfilePage) },
  { path: 'mentorat', canActivate: [mentorGuard], loadComponent: () => import('./pages/mentor.page').then((m) => m.MentorPage) },
  { path: 'admin', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'admin/modules', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/modules.page').then((m) => m.AdminModulesPage) },
  { path: 'admin/modules/:id', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/course-editor.page').then((m) => m.CourseEditorPage) },
  { path: 'admin/modules/:id/analyse', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/insights.page').then((m) => m.InsightsPage) },
  { path: 'admin/apprenants', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/learners.page').then((m) => m.LearnersPage) },
  { path: 'admin/ia', canActivate: [staffGuard], loadComponent: () => import('./pages/admin/ai-supervision.page').then((m) => m.AiSupervisionPage) },
  { path: '**', redirectTo: 'accueil' },
];
