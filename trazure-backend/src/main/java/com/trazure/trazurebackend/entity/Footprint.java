package com.trazure.trazurebackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("footprints")
public class Footprint {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    // 🌍 核心地图索引
    private String regionId;
    private String layerType;

    // 📍 地理坐标
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String locationName;

    // 🎨 情感与分类
    private Integer category;
    private Boolean isBucketList;

    // 💊 深度记忆胶囊 (完整元数据)
    private LocalDateTime visitTime;
    private String purpose;
    private String companions;
    private String mood;
    private String description;
    private BigDecimal cost;
    private String transportMode;
    private String pois;
    private String highlight;
    private String pets;
    private String badExperience;
    private String newFriends;

    // ⏱️ 时间记录
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}