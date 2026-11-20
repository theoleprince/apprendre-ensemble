package org.formation.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Taches planifiees : rappels d'apprentissage (et rejeu du mode relais). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
