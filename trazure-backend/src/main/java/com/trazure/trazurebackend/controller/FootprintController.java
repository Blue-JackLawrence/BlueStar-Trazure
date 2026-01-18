package com.trazure.trazurebackend.controller;

import com.trazure.trazurebackend.entity.Footprint;
import com.trazure.trazurebackend.service.FootprintService; // 引用接口
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/footprints")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class FootprintController {

    @Autowired
    private FootprintService footprintService;

    // 🔴 修改点：返回值从 String 改为 Long (返回生成的ID)
    @PostMapping("/light-up")
    public Long saveFootprint(@RequestBody Footprint footprint) {
        footprintService.lightUp(footprint);
        // MybatisPlus 插入后会自动回填 ID 到对象中
        return footprint.getId();
    }

    @GetMapping("/list")
    public List<Footprint> getAllFootprints() {
        return footprintService.getMyFootprints();
    }
}