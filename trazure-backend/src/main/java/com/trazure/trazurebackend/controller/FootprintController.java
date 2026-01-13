package com.trazure.trazurebackend.controller;

import com.trazure.trazurebackend.entity.Footprint;
import com.trazure.trazurebackend.mapper.FootprintMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/footprints") // 所有接口都以 /footprints 开头
public class FootprintController {

    @Autowired
    private FootprintMapper footprintMapper;

    // 1. 保存足迹 (POST /footprints)
    @PostMapping
    public String saveFootprint(@RequestBody Footprint footprint) {
        // 暂时把用户ID写死为 1 (JackLawrence)，以后做了登录再改
        footprint.setUserId(1L);
        footprint.setVisitTime(LocalDateTime.now()); // 默认时间为当前

        footprintMapper.insert(footprint);
        return "success";
    }

    // 2. 获取所有足迹 (GET /footprints)
    // 用于把数据库里存的所有点都显示在地图上
    @GetMapping
    public List<Footprint> getAllFootprints() {
        return footprintMapper.selectList(null);
    }
}