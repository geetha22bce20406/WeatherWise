package com.weatherwise.weatherwise.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "farm_profiles")
public class FarmProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false, length = 80)
    private String crop;

    @Column(nullable = false, length = 80)
    private String growthStage;

    @Column(nullable = false, length = 100)
    private String activity;

    @Column(length = 100)
    private String location;

    @Column(length = 100)
    private String soilType;

    private LocalDateTime createdAt = LocalDateTime.now();

    public FarmProfile() {}

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getCrop() { return crop; }
    public String getGrowthStage() { return growthStage; }
    public String getActivity() { return activity; }
    public String getLocation() { return location; }
    public String getSoilType() { return soilType; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setUser(UserAccount user) { this.user = user; }
    public void setCrop(String crop) { this.crop = crop; }
    public void setGrowthStage(String growthStage) { this.growthStage = growthStage; }
    public void setActivity(String activity) { this.activity = activity; }
    public void setLocation(String location) { this.location = location; }
    public void setSoilType(String soilType) { this.soilType = soilType; }
}